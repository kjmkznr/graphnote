import cytoscape from 'cytoscape';
import type { RawNode, RawEdge, CanvasEvent, InteractionMode } from '../types.js';

const NODE_SPACING = 110; // minimum distance between node centers

/**
 * Find a position that doesn't overlap with any of the occupied positions.
 * Searches outward in a spiral from the centroid of existing nodes.
 */
function findFreePosition(occupied: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (occupied.length === 0) return { x: 0, y: 0 };

  const cx = occupied.reduce((s, p) => s + p.x, 0) / occupied.length;
  const cy = occupied.reduce((s, p) => s + p.y, 0) / occupied.length;

  const isFree = (x: number, y: number) =>
    occupied.every((p) => Math.hypot(p.x - x, p.y - y) >= NODE_SPACING);

  for (let r = NODE_SPACING; r <= NODE_SPACING * 20; r += NODE_SPACING) {
    const steps = Math.max(6, Math.round((2 * Math.PI * r) / NODE_SPACING));
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (isFree(x, y)) return { x, y };
    }
  }

  // Fallback: offset from centroid
  return { x: cx + NODE_SPACING, y: cy + NODE_SPACING };
}

const PALETTE = [
  '#6c8ef7', '#a78bfa', '#34d399', '#f87171',
  '#fbbf24', '#38bdf8', '#fb923c', '#e879f9',
];

const labelColors = new Map<string, string>();
let paletteIdx = 0;

function colorForLabel(label: string): string {
  if (!labelColors.has(label)) {
    labelColors.set(label, PALETTE[paletteIdx % PALETTE.length] ?? '#6c8ef7');
    paletteIdx++;
  }
  return labelColors.get(label)!;
}

type PositionMap = Record<string, { x: number; y: number }>;

function nodeDisplayData(node: RawNode): { displayLabel: string; color: string } {
  const label = node._labels[0] ?? '';
  const name = (node._properties['name'] as string | undefined) ?? (label || (node._properties['gnId'] as string).slice(0, 8));
  return {
    displayLabel: `${name}\n:${label}`,
    color: colorForLabel(label),
  };
}

function edgeElementDef(
  edge: RawEdge,
  nodes: RawNode[],
): cytoscape.ElementDefinition | null {
  const gnId = edge._properties['gnId'] as string | undefined;
  if (!gnId) return null;
  const srcNode = nodes.find((n) => n._id === edge._src);
  const dstNode = nodes.find((n) => n._id === edge._dst);
  const srcGnId = srcNode?._properties['gnId'] as string | undefined;
  const dstGnId = dstNode?._properties['gnId'] as string | undefined;
  if (!srcGnId || !dstGnId) return null;
  return {
    group: 'edges',
    data: { id: `e-${gnId}`, gnId, source: srcGnId, target: dstGnId, label: edge._type },
  };
}

export class Canvas {
  private cy: cytoscape.Core;
  private onEvent: (e: CanvasEvent) => void;
  private mode: InteractionMode = 'select';

  // edge-creation drag state
  private dragState: { active: false } | { active: true; sourceGnId: string } = { active: false };

  // Positions hinted from outside (e.g. click position) for the next refresh
  private positionHints = new Map<string, { x: number; y: number }>();

  constructor(container: HTMLElement, onEvent: (e: CanvasEvent) => void) {
    this.onEvent = onEvent;

    this.cy = cytoscape({
      container,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(displayLabel)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-family': 'ui-monospace, monospace',
            'width': 56,
            'height': 56,
            'text-wrap': 'wrap',
            'text-max-width': '64px',
            'border-width': 2,
            'border-color': 'data(borderColor)',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#fff',
          },
        },
        {
          selector: 'node[?ghost]',
          style: {
            'width': 10,
            'height': 10,
            'background-color': 'transparent',
            'border-width': 0,
            'label': '',
            'events': 'no',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#4a5568',
            'target-arrow-color': '#4a5568',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'font-family': 'ui-monospace, monospace',
            'color': '#8892a4',
            'text-background-color': '#0f1117',
            'text-background-opacity': 1,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#6c8ef7',
            'target-arrow-color': '#6c8ef7',
            'color': '#e2e8f0',
          },
        },
        {
          selector: 'edge[?ghost]',
          style: {
            'width': 2,
            'line-color': '#6c8ef7',
            'target-arrow-color': '#6c8ef7',
            'target-arrow-shape': 'triangle',
            'line-style': 'dashed',
            'opacity': 0.6,
            'events': 'no',
          },
        },
      ],
      layout: { name: 'preset' },
      wheelSensitivity: 0.3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    this.bindEvents();
  }

  private bindEvents(): void {
    const cy = this.cy;

    // Click on node
    cy.on('tap', 'node:not([ghost])', (e) => {
      if (this.dragState.active) return;
      const gnId = e.target.data('gnId') as string;
      if (gnId) this.onEvent({ kind: 'node-clicked', gnId });
    });

    // Click on edge
    cy.on('tap', 'edge:not([ghost])', (e) => {
      const gnId = e.target.data('gnId') as string;
      if (gnId) this.onEvent({ kind: 'edge-clicked', gnId });
    });

    // Click on background — node creation mode
    cy.on('tap', (e) => {
      if (e.target !== cy) return;
      if (this.mode === 'node') {
        const pos = e.position;
        this.onEvent({ kind: 'canvas-clicked', position: { x: pos.x, y: pos.y } });
      }
    });

    // Right-click context menu
    cy.on('cxttap', 'node:not([ghost])', (e) => {
      const gnId = e.target.data('gnId') as string;
      const orig = e.originalEvent as MouseEvent;
      if (gnId) this.onEvent({ kind: 'node-context', gnId, x: orig.clientX, y: orig.clientY });
    });

    cy.on('cxttap', 'edge:not([ghost])', (e) => {
      const gnId = e.target.data('gnId') as string;
      const orig = e.originalEvent as MouseEvent;
      if (gnId) this.onEvent({ kind: 'edge-context', gnId, x: orig.clientX, y: orig.clientY });
    });

    cy.on('cxttap', (e) => {
      if (e.target !== cy) return;
      const orig = e.originalEvent as MouseEvent;
      this.onEvent({ kind: 'bg-context', x: orig.clientX, y: orig.clientY });
    });

    // Edge-creation drag
    cy.on('mousedown', 'node:not([ghost])', (e) => {
      if (this.mode !== 'edge') return;
      e.preventDefault();
      const gnId = e.target.data('gnId') as string;
      if (!gnId) return;

      this.dragState = { active: true, sourceGnId: gnId };

      // Add ghost target + ghost edge
      const pos = e.target.position();
      cy.add([
        { group: 'nodes', data: { id: '__ghost_target', ghost: true }, position: { x: pos.x + 1, y: pos.y + 1 } },
        { group: 'edges', data: { id: '__ghost_edge', source: e.target.id(), target: '__ghost_target', ghost: true } },
      ]);
    });

    cy.on('mousemove', (e) => {
      if (!this.dragState.active) return;
      const pos = e.position;
      const ghost = cy.$('#__ghost_target');
      if (ghost.length) ghost.position({ x: pos.x, y: pos.y });
    });

    cy.on('mouseup', 'node:not([ghost])', (e) => {
      if (!this.dragState.active) return;
      const targetGnId = e.target.data('gnId') as string;
      const { sourceGnId } = this.dragState;
      this.cleanupGhost();
      if (targetGnId && targetGnId !== sourceGnId) {
        this.onEvent({ kind: 'edge-created', sourceGnId, targetGnId });
      }
    });

    cy.on('mouseup', (e) => {
      if (!this.dragState.active) return;
      // Clean up ghost if mouseup was on background or on the ghost node itself
      const target = e.target as unknown;
      if (target === cy) {
        this.cleanupGhost();
      }
    });
  }

  private cleanupGhost(): void {
    this.dragState = { active: false };
    const cy = this.cy;
    cy.$('#__ghost_edge').remove();
    cy.$('#__ghost_target').remove();
  }

  setMode(mode: InteractionMode): void {
    this.mode = mode;
    if (mode === 'edge') {
      // Disable node dragging in edge-creation mode
      this.cy.nodes(':not([ghost])').forEach((n) => { n.ungrabify(); });
      this.cy.userPanningEnabled(false);
    } else {
      // select and node modes: nodes are draggable
      this.cy.nodes(':not([ghost])').forEach((n) => { n.grabify(); });
      this.cy.userPanningEnabled(mode === 'select');
    }
  }

  /** Hint where a newly created node (by gnId) should be placed on next refresh. */
  hintPosition(gnId: string, pos: { x: number; y: number }): void {
    this.positionHints.set(gnId, pos);
  }

  refreshGraph(
    nodes: RawNode[],
    edges: RawEdge[],
    savedPositions?: Record<string, { x: number; y: number }>,
  ): void {
    if (savedPositions) {
      this.fullRefresh(nodes, edges, savedPositions);
    } else {
      this.diffRefresh(nodes, edges);
    }
    // Re-apply mode settings to any newly added nodes
    this.setMode(this.mode);
  }

  /**
   * Full clear + rebuild used only on initial load (when savedPositions is provided).
   */
  private fullRefresh(
    nodes: RawNode[],
    edges: RawEdge[],
    savedPositions: Record<string, { x: number; y: number }>,
  ): void {
    const cy = this.cy;
    cy.elements().remove();

    const elements: cytoscape.ElementDefinition[] = [];
    const newNodeGnIds: string[] = [];

    for (const node of nodes) {
      const gnId = node._properties['gnId'] as string | undefined;
      if (!gnId) continue;
      const { displayLabel, color } = nodeDisplayData(node);
      const pos = savedPositions[gnId] ?? this.positionHints.get(gnId);
      if (!pos) newNodeGnIds.push(gnId);
      elements.push({
        group: 'nodes',
        data: { id: gnId, gnId, displayLabel, nodeLabel: node._labels[0] ?? '', color, borderColor: color },
        ...(pos ? { position: pos } : {}),
      });
    }

    this.positionHints.clear();

    for (const edge of edges) {
      const def = edgeElementDef(edge, nodes);
      if (def) elements.push(def);
    }

    cy.add(elements);
    this.placeNewNodes(newNodeGnIds);
  }

  /**
   * Incremental diff update: add/remove/update only changed elements.
   * Node positions are preserved.
   */
  private diffRefresh(nodes: RawNode[], edges: RawEdge[]): void {
    const cy = this.cy;

    // Build lookup maps for the desired state
    const desiredNodes = new Map<string, RawNode>();
    for (const n of nodes) {
      const gnId = n._properties['gnId'] as string | undefined;
      if (gnId) desiredNodes.set(gnId, n);
    }

    const desiredEdges = new Map<string, RawEdge>();
    for (const e of edges) {
      const gnId = e._properties['gnId'] as string | undefined;
      if (gnId) desiredEdges.set(gnId, e);
    }

    // ── Nodes ──────────────────────────────────────────────────────────────
    const existingNodeIds = new Set<string>();
    cy.nodes(':not([ghost])').forEach((n) => {
      const gnId = n.data('gnId') as string;
      existingNodeIds.add(gnId);
      if (!desiredNodes.has(gnId)) {
        n.remove();
      } else {
        // Update mutable display data (label/name may change)
        const rawNode = desiredNodes.get(gnId)!;
        const { displayLabel, color } = nodeDisplayData(rawNode);
        n.data({ displayLabel, nodeLabel: rawNode._labels[0] ?? '', color, borderColor: color });
      }
    });

    // Add new nodes
    const newNodeGnIds: string[] = [];
    const newNodeElements: cytoscape.ElementDefinition[] = [];
    for (const [gnId, rawNode] of desiredNodes) {
      if (existingNodeIds.has(gnId)) continue;
      const { displayLabel, color } = nodeDisplayData(rawNode);
      const pos = this.positionHints.get(gnId);
      if (!pos) newNodeGnIds.push(gnId);
      newNodeElements.push({
        group: 'nodes',
        data: { id: gnId, gnId, displayLabel, nodeLabel: rawNode._labels[0] ?? '', color, borderColor: color },
        ...(pos ? { position: pos } : {}),
      });
    }

    this.positionHints.clear();

    if (newNodeElements.length > 0) cy.add(newNodeElements);
    this.placeNewNodes(newNodeGnIds);

    // ── Edges ──────────────────────────────────────────────────────────────
    cy.edges(':not([ghost])').forEach((e) => {
      const gnId = e.data('gnId') as string;
      if (!desiredEdges.has(gnId)) e.remove();
    });

    const existingEdgeIds = new Set<string>(
      cy.edges(':not([ghost])').map((e) => e.data('gnId') as string),
    );
    const newEdgeElements: cytoscape.ElementDefinition[] = [];
    for (const [gnId, rawEdge] of desiredEdges) {
      if (existingEdgeIds.has(gnId)) continue;
      const def = edgeElementDef(rawEdge, nodes);
      if (def) newEdgeElements.push(def);
    }
    if (newEdgeElements.length > 0) cy.add(newEdgeElements);
  }

  private placeNewNodes(gnIds: string[]): void {
    if (gnIds.length === 0) return;
    const cy = this.cy;
    const occupied = cy.nodes(':not([ghost])').map((n) => n.position());
    const selector = gnIds.map((id) => `#${CSS.escape(id)}`).join(', ');
    cy.$(selector).forEach((n) => {
      const pos = findFreePosition(occupied);
      n.position(pos);
      occupied.push(pos);
    });
  }

  getPositions(): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    this.cy.nodes(':not([ghost])').forEach((n) => {
      const gnId = n.data('gnId') as string;
      if (gnId) positions[gnId] = { ...n.position() };
    });
    return positions;
  }

  fitView(): void {
    this.cy.fit(undefined, 40);
  }

  resize(): void {
    this.cy.resize();
  }

  deselectAll(): void {
    this.cy.elements().unselect();
  }
}
