import cytoscape from 'cytoscape';
import type { EdgeTypeRegistry } from '../graph/edgeTypeRegistry.js';
import type { TypeRegistry } from '../graph/typeRegistry.js';
import type {
  CanvasEvent,
  GnId,
  InteractionMode,
  PersistedGroup,
  RawEdge,
  RawNode,
} from '../types.js';
import { asGnId } from '../types.js';
import { buildEdgeTypeStyles, buildNodeTypeStyles, CYTOSCAPE_STYLES } from './cytoscapeStyles.js';
import type { PositionMap } from './graphRenderer.js';
import { GraphRenderer } from './graphRenderer.js';
import { Minimap } from './minimap.js';

// Edgehandles の grab 領域。Cytoscape のデフォルト node サイズ (40px) + マージン
const EDGE_HANDLE_DISTANCE = 52;
// ノードからハンドルへマウスを移動する余裕を持たせる遅延 (ms)
const EDGE_HANDLE_REMOVE_DELAY_MS = 600;

/**
 * Compute the union bounding box of a compound node's children, excluding
 * one child by gnId. Returns null if no other children exist.
 * Pads slightly so dropping near the edge still counts as "inside".
 */
function bboxExcludingChild(
  group: cytoscape.NodeSingular,
  excludeGnId: string,
): { x1: number; y1: number; x2: number; y2: number } | null {
  // If empty group (or only contains the dragged node), fall back to the
  // group's own rendered bounding box so users can drop the first node into
  // a freshly created empty group.
  const others = group
    .children('[!ghost][!edgeHandle]')
    .filter((c) => c.data('gnId') !== excludeGnId);

  if (others.length === 0) {
    const bb = group.boundingBox({ includeLabels: false });
    return { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 };
  }

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  others.forEach((c) => {
    const bb = c.boundingBox({ includeLabels: false });
    if (bb.x1 < x1) x1 = bb.x1;
    if (bb.y1 < y1) y1 = bb.y1;
    if (bb.x2 > x2) x2 = bb.x2;
    if (bb.y2 > y2) y2 = bb.y2;
  });
  // Pad by group padding (24px in styles) so the catchment zone matches the rendered border.
  const pad = 28;
  return { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad };
}

function getEventClientPos(e: MouseEvent | TouchEvent): {
  x: number;
  y: number;
} {
  if ('touches' in e) {
    const t = e.changedTouches[0] ?? e.touches[0];
    if (!t) return { x: 0, y: 0 };
    return { x: t.clientX, y: t.clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

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
  private dragState: { active: false } | { active: true; sourceGnId: GnId } = {
    active: false,
  };

  // Timer for delayed edge-handle removal (prevents flicker on node→handle transitions)
  private edgeHandleTimer: ReturnType<typeof setTimeout> | null = null;

  private nodeRegistry: TypeRegistry;
  private edgeRegistryRef: EdgeTypeRegistry;

  constructor(
    container: HTMLElement,
    private onEvent: (e: CanvasEvent) => void,
    nodeRegistry: TypeRegistry,
    edgeRegistry: EdgeTypeRegistry,
  ) {
    this.nodeRegistry = nodeRegistry;
    this.edgeRegistryRef = edgeRegistry;
    this.cy = cytoscape({
      container,
      style: CYTOSCAPE_STYLES,
      layout: { name: 'preset' },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      textureOnViewport: true,
      hideEdgesOnViewport: true,
    });

    this.renderer = new GraphRenderer(this.cy, this.nodeRegistry);
    const parent = container.parentElement;
    if (!parent) throw new Error('Canvas container has no parent element');
    new Minimap(parent, this.cy);
    this.bindEvents();
    this.applyStyles();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Expose the Cytoscape core for advanced operations (e.g. search navigation). */
  getCy(): cytoscape.Core {
    return this.cy;
  }

  getMode(): InteractionMode {
    return this.mode;
  }

  setMode(mode: InteractionMode, newNodeGnIds?: GnId[]): void {
    this.mode = mode;
    // Only grabify newly added nodes; existing nodes retain their state.
    // On a full mode switch (no newNodeGnIds), grabify all real nodes.
    if (newNodeGnIds) {
      if (newNodeGnIds.length > 0) {
        const selector = newNodeGnIds.map((id) => `#${CSS.escape(id)}`).join(', ');
        this.cy.nodes(selector).forEach((n) => {
          n.grabify();
        });
      }
    } else {
      this.cy.nodes('[!ghost][!edgeHandle][!isGroup]').forEach((n) => {
        n.grabify();
      });
      this.cy.nodes('[?isGroup]').forEach((n) => {
        n.grabify();
      });
    }
    this.cy.userPanningEnabled(true);
    const container = this.cy.container();
    if (container) container.style.cursor = mode === 'node' ? 'crosshair' : '';
    if (mode === 'node') this.removeEdgeHandles();
  }

  /** Pre-assign a canvas position for a node that will appear on the next refresh. */
  hintPosition(gnId: GnId, pos: { x: number; y: number }): void {
    this.renderer.hintPosition(gnId, pos);
  }

  refreshGraph(
    nodes: RawNode[],
    edges: RawEdge[],
    savedPositions?: PositionMap,
    groups: PersistedGroup[] = [],
  ): void {
    const newNodeGnIds = this.renderer.refreshGraph(nodes, edges, savedPositions, groups);
    // Apply grabify only to newly added nodes (full rebuild passes all node gnIds)
    this.setMode(this.mode, newNodeGnIds);
  }

  getPositions(): PositionMap {
    return this.renderer.getPositions();
  }

  getGroupPositions(): PositionMap {
    return this.renderer.getGroupPositions();
  }

  getViewport(): { pan: { x: number; y: number }; zoom: number } {
    return { pan: this.cy.pan(), zoom: this.cy.zoom() };
  }

  setViewport(pan: { x: number; y: number }, zoom: number): void {
    this.cy.viewport({ pan, zoom });
  }

  highlightByGnId(nodeGnIds: Set<GnId>, edgeGnIds: Set<GnId>, sourceGnId?: GnId): void {
    this.renderer.highlightByGnId(nodeGnIds, edgeGnIds, sourceGnId);
  }

  clearHighlight(): void {
    this.renderer.clearHighlight();
  }

  getHighlightState(): { nodes: Set<GnId>; edges: Set<GnId> } {
    return this.renderer.getHighlightState();
  }

  fitView(): void {
    this.cy.fit(undefined, 40);
  }

  applyLayout(
    name: 'cose' | 'circle' | 'concentric' | 'grid' | 'breadthfirst' | 'radial' | 'hierarchical',
  ): void {
    let options: cytoscape.LayoutOptions;
    if (name === 'radial') {
      options = {
        name: 'breadthfirst',
        circle: true,
        animate: true,
        animationDuration: 400,
      } as cytoscape.LayoutOptions;
    } else if (name === 'hierarchical') {
      options = {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 1.5,
        animate: true,
        animationDuration: 400,
      } as cytoscape.LayoutOptions;
    } else {
      options = { name, animate: true, animationDuration: 400 } as cytoscape.LayoutOptions;
    }
    this.cy.layout(options).run();
  }

  resize(): void {
    const pan = this.cy.pan();
    const zoom = this.cy.zoom();
    this.cy.resize();
    this.cy.viewport({ pan, zoom });
  }

  png(): string {
    return this.cy.png({
      full: false,
      scale: 0.5,
      maxWidth: 800,
      maxHeight: 600,
    });
  }

  /** Convert a client (screen) coordinate to a Cytoscape canvas (model) coordinate. */
  clientToCanvasPosition(clientX: number, clientY: number): { x: number; y: number } {
    const container = this.cy.container();
    if (!container) throw new Error('Cytoscape container is not available');
    const rect = container.getBoundingClientRect();
    const pan = this.cy.pan();
    const zoom = this.cy.zoom();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  deselectAll(): void {
    this.cy.elements().unselect();
  }

  updateEdgeStyles(edgeRegistry: EdgeTypeRegistry): void {
    this.edgeRegistryRef = edgeRegistry;
    this.applyStyles();
  }

  updateNodeStyles(nodeRegistry: TypeRegistry): void {
    this.nodeRegistry = nodeRegistry;
    this.renderer.setRegistry(nodeRegistry);
    this.applyStyles();
  }

  private applyStyles(): void {
    const edgeTypeStyles = this.edgeRegistryRef ? buildEdgeTypeStyles(this.edgeRegistryRef) : [];
    const nodeTypeStyles = this.nodeRegistry ? buildNodeTypeStyles(this.nodeRegistry) : [];
    this.cy.style([...CYTOSCAPE_STYLES, ...nodeTypeStyles, ...edgeTypeStyles]);
  }

  // ── Event binding ───────────────────────────────────────────────────────────

  private bindEvents(): void {
    this.bindTapEvents();
    this.bindHoverEvents();
    this.bindEdgeDragEvents();
    this.bindDeleteKeyEvent();
    this.bindGroupEvents();
  }

  private bindGroupEvents(): void {
    const cy = this.cy;

    cy.on('tap', 'node[?isGroup]', (e) => {
      if (this.dragState.active) return;
      const groupId = asGnId(e.target.data('gnId') as string);
      if (groupId) this.onEvent({ kind: 'group-clicked', groupId });
    });

    cy.on('cxttap', 'node[?isGroup]', (e) => {
      const groupId = asGnId(e.target.data('gnId') as string);
      const { x, y } = getEventClientPos(e.originalEvent as MouseEvent | TouchEvent);
      if (groupId) this.onEvent({ kind: 'group-context', groupId, x, y });
    });

    cy.on('dbltap', 'node[?isGroup]', (e) => {
      const groupId = asGnId(e.target.data('gnId') as string);
      if (groupId) this.onEvent({ kind: 'group-dblclick', groupId });
    });

    // Re-evaluate parent when a normal node finishes being dragged.
    cy.on('dragfree', 'node[!ghost][!edgeHandle][!isGroup]', (e) => {
      const n = e.target as cytoscape.NodeSingular;
      const gnId = asGnId(n.data('gnId') as string);
      if (!gnId) return;
      const pos = n.position();
      const targetGroupId = this.findGroupAtPosition(pos, gnId);
      const parents = n.parent();
      const currentParent = parents.nonempty() ? asGnId(parents.first().id()) : null;
      if (targetGroupId !== currentParent) {
        this.onEvent({ kind: 'node-group-changed', gnId, groupId: targetGroupId });
      }
    });
  }

  /**
   * Find the smallest group whose bounding box contains `pos`, excluding the
   * node being dragged so its own contribution to the parent bbox is ignored.
   */
  private findGroupAtPosition(pos: { x: number; y: number }, excludeGnId: GnId): GnId | null {
    let best: { id: GnId; area: number } | null = null;
    this.cy.nodes('[?isGroup]').forEach((g) => {
      const groupId = asGnId(g.data('gnId') as string);
      if (!groupId) return;
      // For containment we shrink the bbox slightly using the children excluding the dragged node.
      const bb = bboxExcludingChild(g, excludeGnId);
      if (!bb) return;
      if (pos.x < bb.x1 || pos.x > bb.x2 || pos.y < bb.y1 || pos.y > bb.y2) return;
      const area = (bb.x2 - bb.x1) * (bb.y2 - bb.y1);
      if (!best || area < best.area) best = { id: groupId, area };
    });
    return best ? (best as { id: GnId; area: number }).id : null;
  }

  private bindTapEvents(): void {
    const cy = this.cy;

    cy.on('tap', 'node[!ghost][!isGroup]', (e) => {
      if (this.dragState.active) return;
      const gnId = asGnId(e.target.data('gnId') as string);
      if (gnId) this.onEvent({ kind: 'node-clicked', gnId });
    });

    cy.on('tap', 'edge[!ghost]', (e) => {
      const gnId = asGnId(e.target.data('gnId') as string);
      if (gnId) this.onEvent({ kind: 'edge-clicked', gnId });
    });

    cy.on('tap', (e) => {
      if (e.target !== cy) return;
      if (this.mode === 'node') {
        const pos = e.position;
        this.onEvent({
          kind: 'canvas-clicked',
          position: { x: pos.x, y: pos.y },
        });
      } else {
        this.onEvent({ kind: 'bg-tap' });
      }
    });

    cy.on('cxttap', 'node[!ghost][!isGroup]', (e) => {
      const gnId = asGnId(e.target.data('gnId') as string);
      const { x, y } = getEventClientPos(e.originalEvent as MouseEvent | TouchEvent);
      if (gnId) this.onEvent({ kind: 'node-context', gnId, x, y });
    });

    cy.on('cxttap', 'edge[!ghost]', (e) => {
      const gnId = asGnId(e.target.data('gnId') as string);
      const { x, y } = getEventClientPos(e.originalEvent as MouseEvent | TouchEvent);
      if (gnId) this.onEvent({ kind: 'edge-context', gnId, x, y });
    });

    cy.on('cxttap', (e) => {
      if (e.target !== cy) return;
      const { x, y } = getEventClientPos(e.originalEvent as MouseEvent | TouchEvent);
      this.onEvent({ kind: 'bg-context', x, y });
    });
  }

  // ── Edge handle hover ──────────────────────────────────────────────────────

  private bindHoverEvents(): void {
    const cy = this.cy;

    cy.on('grab', 'node', (e) => {
      const t = e.target as cytoscape.NodeSingular;
      if (t.data('edgeHandle') || t.data('ghost')) return;
      this.removeEdgeHandles();
    });

    cy.on('mouseover', 'node', (e) => {
      const t = e.target as cytoscape.NodeSingular;
      if (t.data('edgeHandle')) {
        if (this.edgeHandleTimer) {
          clearTimeout(this.edgeHandleTimer);
          this.edgeHandleTimer = null;
        }
        // Keep only the hovered handle; remove the others
        this.cy.$('node[?edgeHandle]').forEach((h) => {
          if (h.id() !== t.id()) h.remove();
        });
        return;
      }
      if (t.data('ghost') || t.data('isGroup')) return;
      if (this.mode !== 'edit') return;
      if (this.edgeHandleTimer) {
        clearTimeout(this.edgeHandleTimer);
        this.edgeHandleTimer = null;
      }
      this.showEdgeHandles(t);
      const gnId = asGnId(t.data('gnId') as string);
      if (gnId) {
        const { x, y } = getEventClientPos(e.originalEvent as MouseEvent | TouchEvent);
        this.onEvent({ kind: 'node-hovered', gnId, x, y });
      }
    });

    cy.on('mouseout', 'node', (e) => {
      const t = e.target as cytoscape.NodeSingular;
      if (t.data('ghost')) return;
      this.edgeHandleTimer = setTimeout(
        () => this.removeEdgeHandles(),
        EDGE_HANDLE_REMOVE_DELAY_MS,
      );
      if (!t.data('edgeHandle')) this.onEvent({ kind: 'element-unhovered' });
    });

    cy.on('mouseover', 'edge[!ghost]', (e) => {
      const gnId = asGnId(e.target.data('gnId') as string);
      if (gnId) {
        const { x, y } = getEventClientPos(e.originalEvent as MouseEvent | TouchEvent);
        this.onEvent({ kind: 'edge-hovered', gnId, x, y });
      }
    });

    cy.on('mouseout', 'edge[!ghost]', () => {
      this.onEvent({ kind: 'element-unhovered' });
    });
  }

  // ── Edge-creation drag from handle ────────────────────────────────────────

  private bindEdgeDragEvents(): void {
    const cy = this.cy;

    cy.on('mousedown', 'node[?edgeHandle]', (e) => {
      e.preventDefault();
      const sourceGnId = asGnId(e.target.data('sourceGnId') as string);
      if (!sourceGnId) return;

      this.removeEdgeHandles();
      this.dragState = { active: true, sourceGnId };

      const pos = e.position;
      cy.add([
        {
          group: 'nodes',
          data: { id: '__ghost_target', ghost: true },
          position: { x: pos.x, y: pos.y },
        },
        {
          group: 'edges',
          data: {
            id: '__ghost_edge',
            source: sourceGnId,
            target: '__ghost_target',
            ghost: true,
          },
        },
      ]);
    });

    cy.on('mousemove', (e) => {
      if (!this.dragState.active) return;
      const ghost = cy.$('#__ghost_target');
      if (ghost.length) ghost.position({ x: e.position.x, y: e.position.y });
    });

    cy.on('mouseup', 'node[!ghost][!edgeHandle]', (e) => {
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

  // ── Delete key ────────────────────────────────────────────────────────────

  private bindDeleteKeyEvent(): void {
    const cy = this.cy;

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable)
      )
        return;
      const selected = cy.$(':selected');
      const nodeGnIds = selected
        .nodes('[!ghost][!edgeHandle][!isGroup]')
        .map((n) => asGnId(n.data('gnId') as string))
        .filter(Boolean);
      const edgeGnIds = selected
        .edges('[!ghost]')
        .map((ed) => asGnId(ed.data('gnId') as string))
        .filter(Boolean);
      if (nodeGnIds.length === 0 && edgeGnIds.length === 0) return;
      this.onEvent({ kind: 'delete-selected', nodeGnIds, edgeGnIds });
    });
  }

  // ── Edge handles ────────────────────────────────────────────────────────────

  private showEdgeHandles(sourceNode: cytoscape.NodeSingular): void {
    this.removeEdgeHandles();
    const pos = sourceNode.position();
    const gnId = asGnId(sourceNode.data('gnId') as string);
    const handles = [
      {
        id: '__handle_e',
        x: pos.x + EDGE_HANDLE_DISTANCE,
        y: pos.y,
        arrowLabel: '→',
      },
      {
        id: '__handle_w',
        x: pos.x - EDGE_HANDLE_DISTANCE,
        y: pos.y,
        arrowLabel: '←',
      },
      {
        id: '__handle_s',
        x: pos.x,
        y: pos.y + EDGE_HANDLE_DISTANCE,
        arrowLabel: '↓',
      },
      {
        id: '__handle_n',
        x: pos.x,
        y: pos.y - EDGE_HANDLE_DISTANCE,
        arrowLabel: '↑',
      },
    ];
    for (const h of handles) {
      this.cy.add({
        group: 'nodes',
        data: {
          id: h.id,
          edgeHandle: true,
          sourceGnId: gnId,
          arrowLabel: h.arrowLabel,
        },
        position: { x: h.x, y: h.y },
      });
      this.cy.getElementById(h.id).ungrabify();
    }
  }

  private removeEdgeHandles(): void {
    if (this.edgeHandleTimer) {
      clearTimeout(this.edgeHandleTimer);
      this.edgeHandleTimer = null;
    }
    this.cy.$('node[?edgeHandle]').remove();
  }

  private cleanupGhost(): void {
    this.dragState = { active: false };
    this.cy.$('#__ghost_edge').remove();
    this.cy.$('#__ghost_target').remove();
  }
}
