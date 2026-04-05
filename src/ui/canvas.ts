import cytoscape from 'cytoscape';
import type { RawNode, RawEdge, CanvasEvent, InteractionMode } from '../types.js';

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

export class Canvas {
  private cy: cytoscape.Core;
  private onEvent: (e: CanvasEvent) => void;
  private mode: InteractionMode = 'select';

  // edge-creation drag state
  private dragState: { active: false } | { active: true; sourceGnId: string } = { active: false };

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
    // Disable node dragging in edge-creation mode
    this.cy.nodes(':not([ghost])').forEach((n) => {
      n.ungrabify();
    });
    if (mode === 'select') {
      this.cy.nodes(':not([ghost])').forEach((n) => {
        n.grabify();
      });
      this.cy.userPanningEnabled(true);
    } else if (mode === 'node') {
      this.cy.userPanningEnabled(false);
    } else {
      this.cy.userPanningEnabled(false);
    }
  }

  refreshGraph(
    nodes: RawNode[],
    edges: RawEdge[],
    savedPositions?: Record<string, { x: number; y: number }>,
  ): void {
    const cy = this.cy;

    // Capture current positions before clearing
    const currentPositions: PositionMap = {};
    cy.nodes(':not([ghost])').forEach((n) => {
      currentPositions[n.data('gnId') as string] = { ...n.position() };
    });

    cy.elements().remove();

    const elements: cytoscape.ElementDefinition[] = [];
    const newNodeGnIds: string[] = [];

    for (const node of nodes) {
      const gnId = node._properties['gnId'] as string | undefined;
      if (!gnId) continue;
      const label = node._labels[0] ?? '';
      const name = (node._properties['name'] as string | undefined) ?? (label || gnId.slice(0, 8));
      const color = colorForLabel(label);

      const pos = savedPositions?.[gnId] ?? currentPositions[gnId];
      if (!pos) newNodeGnIds.push(gnId);

      elements.push({
        group: 'nodes',
        data: {
          id: gnId,
          gnId,
          displayLabel: `${name}\n:${label}`,
          nodeLabel: label,
          color,
          borderColor: color,
        },
        ...(pos ? { position: pos } : {}),
      });
    }

    for (const edge of edges) {
      const gnId = edge._properties['gnId'] as string | undefined;
      if (!gnId) continue;

      // Find gnId of source and target nodes
      const srcNode = nodes.find((n) => n._id === edge._src);
      const dstNode = nodes.find((n) => n._id === edge._dst);
      const srcGnId = srcNode?._properties['gnId'] as string | undefined;
      const dstGnId = dstNode?._properties['gnId'] as string | undefined;
      if (!srcGnId || !dstGnId) continue;

      elements.push({
        group: 'edges',
        data: {
          id: `e-${gnId}`,
          gnId,
          source: srcGnId,
          target: dstGnId,
          label: edge._type,
        },
      });
    }

    cy.add(elements);

    // Layout only newly added nodes (those without a position)
    if (newNodeGnIds.length > 0) {
      const selector = newNodeGnIds.map((id) => `#${CSS.escape(id)}`).join(', ');
      const newNodes = cy.$(selector);
      if (newNodes.length > 0) {
        const bb = cy.extent();
        newNodes.forEach((n, i) => {
          n.position({
            x: bb.x1 + 80 + (i % 5) * 120,
            y: bb.y1 + 80 + Math.floor(i / 5) * 120,
          });
        });
      }
    }

    // Re-apply mode settings to new nodes
    this.setMode(this.mode);
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
