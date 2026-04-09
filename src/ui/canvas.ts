import cytoscape from 'cytoscape';
import { asGnId } from '../types.js';
import type { GnId, RawNode, RawEdge, CanvasEvent, InteractionMode } from '../types.js';
import { GraphRenderer } from './graphRenderer.js';
import type { PositionMap } from './graphRenderer.js';
import { CYTOSCAPE_STYLES } from './cytoscapeStyles.js';

export type { PositionMap };

/**
 * Owns the Cytoscape instance and handles all user interactions:
 * click/context/drag events, mode switching, and edge-creation handles.
 *
 * Graph element rendering is delegated to GraphRenderer.
 */
export class Canvas {
  private cy: cytoscape.Core;
  private renderer: GraphRenderer;
  private mode: InteractionMode = 'edit';

  // Edge-creation drag state
  private dragState: { active: false } | { active: true; sourceGnId: GnId } = { active: false };

  // Timer for delayed edge-handle removal (prevents flicker on node→handle transitions)
  private edgeHandleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, private onEvent: (e: CanvasEvent) => void) {
    this.cy = cytoscape({
      container,
      style: CYTOSCAPE_STYLES,
      layout: { name: 'preset' },
      wheelSensitivity: 0.3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    this.renderer = new GraphRenderer(this.cy);
    this.bindEvents();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getMode(): InteractionMode { return this.mode; }

  setMode(mode: InteractionMode): void {
    this.mode = mode;
    // All modes keep nodes draggable and panning enabled
    this.cy.nodes(':not([ghost]):not([edgeHandle])').forEach((n) => { n.grabify(); });
    this.cy.userPanningEnabled(true);
    const container = this.cy.container();
    if (container) container.style.cursor = mode === 'node' ? 'crosshair' : '';
    if (mode === 'node') this.removeEdgeHandles();
  }

  /** Pre-assign a canvas position for a node that will appear on the next refresh. */
  hintPosition(gnId: GnId, pos: { x: number; y: number }): void {
    this.renderer.hintPosition(gnId, pos);
  }

  refreshGraph(nodes: RawNode[], edges: RawEdge[], savedPositions?: PositionMap): void {
    this.renderer.refreshGraph(nodes, edges, savedPositions);
    // Re-apply mode settings to any newly added nodes
    this.setMode(this.mode);
  }

  getPositions(): PositionMap { return this.renderer.getPositions(); }

  getViewport(): { pan: { x: number; y: number }; zoom: number } {
    return { pan: this.cy.pan(), zoom: this.cy.zoom() };
  }

  setViewport(pan: { x: number; y: number }, zoom: number): void {
    this.cy.viewport({ pan, zoom });
  }

  highlightByGnId(nodeGnIds: Set<GnId>, edgeGnIds: Set<GnId>): void {
    this.renderer.highlightByGnId(nodeGnIds, edgeGnIds);
  }

  clearHighlight(): void { this.renderer.clearHighlight(); }

  fitView(): void { this.cy.fit(undefined, 40); }

  resize(): void {
    const pan = this.cy.pan();
    const zoom = this.cy.zoom();
    this.cy.resize();
    this.cy.viewport({ pan, zoom });
  }

  png(): string { return this.cy.png({ full: true, scale: 0.5, maxWidth: 800, maxHeight: 600 }); }

  deselectAll(): void { this.cy.elements().unselect(); }

  // ── Event binding ───────────────────────────────────────────────────────────

  private bindEvents(): void {
    const cy = this.cy;

    cy.on('tap', 'node:not([ghost])', (e) => {
      if (this.dragState.active) return;
      const gnId = asGnId(e.target.data('gnId') as string);
      if (gnId) this.onEvent({ kind: 'node-clicked', gnId });
    });

    cy.on('tap', 'edge:not([ghost])', (e) => {
      const gnId = asGnId(e.target.data('gnId') as string);
      if (gnId) this.onEvent({ kind: 'edge-clicked', gnId });
    });

    cy.on('tap', (e) => {
      if (e.target !== cy) return;
      if (this.mode === 'node') {
        const pos = e.position;
        this.onEvent({ kind: 'canvas-clicked', position: { x: pos.x, y: pos.y } });
      }
    });

    cy.on('cxttap', 'node:not([ghost])', (e) => {
      const gnId = asGnId(e.target.data('gnId') as string);
      const orig = e.originalEvent as MouseEvent;
      if (gnId) this.onEvent({ kind: 'node-context', gnId, x: orig.clientX, y: orig.clientY });
    });

    cy.on('cxttap', 'edge:not([ghost])', (e) => {
      const gnId = asGnId(e.target.data('gnId') as string);
      const orig = e.originalEvent as MouseEvent;
      if (gnId) this.onEvent({ kind: 'edge-context', gnId, x: orig.clientX, y: orig.clientY });
    });

    cy.on('cxttap', (e) => {
      if (e.target !== cy) return;
      const orig = e.originalEvent as MouseEvent;
      this.onEvent({ kind: 'bg-context', x: orig.clientX, y: orig.clientY });
    });

    // ── Edge handle hover ────────────────────────────────────────────────────

    cy.on('grab', 'node', (e) => {
      const t = e.target as cytoscape.NodeSingular;
      if (t.data('edgeHandle') || t.data('ghost')) return;
      this.removeEdgeHandles();
    });

    cy.on('mouseover', 'node', (e) => {
      const t = e.target as cytoscape.NodeSingular;
      if (t.data('edgeHandle')) {
        if (this.edgeHandleTimer) { clearTimeout(this.edgeHandleTimer); this.edgeHandleTimer = null; }
        // Keep only the hovered handle; remove the others
        this.cy.$('node[?edgeHandle]').forEach((h) => { if (h.id() !== t.id()) h.remove(); });
        return;
      }
      if (t.data('ghost')) return;
      if (this.mode !== 'edit') return;
      if (this.edgeHandleTimer) { clearTimeout(this.edgeHandleTimer); this.edgeHandleTimer = null; }
      this.showEdgeHandles(t);
    });

    cy.on('mouseout', 'node', (e) => {
      const t = e.target as cytoscape.NodeSingular;
      if (t.data('ghost')) return;
      this.edgeHandleTimer = setTimeout(() => this.removeEdgeHandles(), 200);
    });

    // ── Edge-creation drag from handle ───────────────────────────────────────

    cy.on('mousedown', 'node[?edgeHandle]', (e) => {
      e.preventDefault();
      const sourceGnId = asGnId(e.target.data('sourceGnId') as string);
      if (!sourceGnId) return;

      this.removeEdgeHandles();
      this.dragState = { active: true, sourceGnId };

      const pos = e.position;
      cy.add([
        { group: 'nodes', data: { id: '__ghost_target', ghost: true }, position: { x: pos.x, y: pos.y } },
        { group: 'edges', data: { id: '__ghost_edge', source: sourceGnId, target: '__ghost_target', ghost: true } },
      ]);
    });

    cy.on('mousemove', (e) => {
      if (!this.dragState.active) return;
      const ghost = cy.$('#__ghost_target');
      if (ghost.length) ghost.position({ x: e.position.x, y: e.position.y });
    });

    cy.on('mouseup', 'node:not([ghost]):not([edgeHandle])', (e) => {
      if (!this.dragState.active) return;
      const targetGnId = asGnId(e.target.data('gnId') as string);
      const { sourceGnId } = this.dragState;
      this.cleanupGhost();
      if (targetGnId && targetGnId !== sourceGnId) {
        this.onEvent({ kind: 'edge-created', sourceGnId, targetGnId });
      }
    });

    cy.on('mouseup', (e) => {
      if (!this.dragState.active) return;
      if ((e.target as unknown) === cy) {
        this.cleanupGhost();
        this.onEvent({ kind: 'edge-drag-cancelled' });
      }
    });
  }

  // ── Edge handles ────────────────────────────────────────────────────────────

  private showEdgeHandles(sourceNode: cytoscape.NodeSingular): void {
    this.removeEdgeHandles();
    const pos = sourceNode.position();
    const gnId = asGnId(sourceNode.data('gnId') as string);
    const d = 52;
    const handles = [
      { id: '__handle_e', x: pos.x + d, y: pos.y,     arrowLabel: '→' },
      { id: '__handle_w', x: pos.x - d, y: pos.y,     arrowLabel: '←' },
      { id: '__handle_s', x: pos.x,     y: pos.y + d, arrowLabel: '↓' },
      { id: '__handle_n', x: pos.x,     y: pos.y - d, arrowLabel: '↑' },
    ];
    for (const h of handles) {
      this.cy.add({
        group: 'nodes',
        data: { id: h.id, edgeHandle: true, sourceGnId: gnId, arrowLabel: h.arrowLabel },
        position: { x: h.x, y: h.y },
      });
      this.cy.getElementById(h.id).ungrabify();
    }
  }

  private removeEdgeHandles(): void {
    if (this.edgeHandleTimer) { clearTimeout(this.edgeHandleTimer); this.edgeHandleTimer = null; }
    this.cy.$('node[?edgeHandle]').remove();
  }

  private cleanupGhost(): void {
    this.dragState = { active: false };
    this.cy.$('#__ghost_edge').remove();
    this.cy.$('#__ghost_target').remove();
  }
}
