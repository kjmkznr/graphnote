import cytoscape from 'cytoscape';
import { asGnId } from '../types.js';
import type { GnId, RawNode, RawEdge } from '../types.js';
import type { TypeRegistry } from '../graph/typeRegistry.js';

// ── Position utilities ────────────────────────────────────────────────────────

export type PositionMap = Record<GnId, { x: number; y: number }>;

const NODE_SPACING = 110; // minimum distance between node centers

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

  return { x: cx + NODE_SPACING, y: cy + NODE_SPACING };
}

// ── Node display helpers ──────────────────────────────────────────────────────

function nodeDisplayData(node: RawNode, registry: TypeRegistry): { displayLabel: string; color: string } {
  const label = node._labels[0] ?? '';
  const name = (node._properties['name'] as string | undefined) ?? (label || (node._properties['gnId'] as string).slice(0, 8));
  const style = registry.getStyle(label);
  return {
    displayLabel: `${name}\n:${label}`,
    color: style.color,
  };
}

function edgeElementDef(
  edge: RawEdge,
  internalIdToGnId: Map<string, GnId>,
): cytoscape.ElementDefinition | null {
  const gnId = edge._properties['gnId'] as GnId | undefined;
  if (!gnId) return null;
  const srcGnId = internalIdToGnId.get(edge._src);
  const dstGnId = internalIdToGnId.get(edge._dst);
  if (!srcGnId || !dstGnId) return null;
  return {
    group: 'edges',
    data: { id: `e-${gnId}`, gnId, source: srcGnId, target: dstGnId, label: edge._type },
  };
}

// ── GraphRenderer ─────────────────────────────────────────────────────────────

/**
 * Manages Cytoscape element state: translates RawNode/RawEdge data into
 * Cytoscape elements and keeps the canvas in sync with the graph DB.
 * Does not handle user interactions or mode — those live in Canvas.
 */
export class GraphRenderer {
  // Positions pre-assigned for nodes about to be added (e.g. from a click location)
  private positionHints = new Map<GnId, { x: number; y: number }>();

  constructor(private cy: cytoscape.Core, private registry: TypeRegistry) {}

  /** Update the node type registry without recreating the renderer (preserves positionHints). */
  setRegistry(registry: TypeRegistry): void {
    this.registry = registry;
  }

  /** Pre-assign a canvas position for a node that will appear on the next refresh. */
  hintPosition(gnId: GnId, pos: { x: number; y: number }): void {
    this.positionHints.set(gnId, pos);
  }

  /**
   * Sync the canvas with the current graph state.
   * - With `savedPositions`: full clear + rebuild (used on initial load / import).
   * - Without: incremental diff (add/remove/update changed elements only).
   */
  refreshGraph(
    nodes: RawNode[],
    edges: RawEdge[],
    savedPositions?: PositionMap,
  ): void {
    if (savedPositions) {
      this.fullRefresh(nodes, edges, savedPositions);
    } else {
      this.diffRefresh(nodes, edges);
    }
  }

  getPositions(): PositionMap {
    const positions: PositionMap = {} as PositionMap;
    this.cy.nodes('[!ghost][!edgeHandle]').forEach((n) => {
      const gnId = asGnId(n.data('gnId') as string);
      if (gnId) positions[gnId] = { ...n.position() };
    });
    return positions;
  }

  /**
   * Highlight nodes and edges matching a query result.
   * Edges between two matched nodes are also highlighted automatically.
   */
  highlightByGnId(nodeGnIds: Set<GnId>, edgeGnIds: Set<GnId>): void {
    const cy = this.cy;
    cy.elements().removeClass('query-match query-dimmed');

    if (nodeGnIds.size === 0 && edgeGnIds.size === 0) return;

    cy.elements().addClass('query-dimmed');
    for (const gnId of nodeGnIds) {
      cy.getElementById(gnId).removeClass('query-dimmed').addClass('query-match');
    }
    for (const gnId of edgeGnIds) {
      const edge = cy.getElementById(`e-${gnId}`);
      edge.removeClass('query-dimmed').addClass('query-match');
      edge.connectedNodes().removeClass('query-dimmed').addClass('query-match');
    }
    // Highlight edges where both endpoints are in the matched node set
    if (nodeGnIds.size > 0) {
      cy.edges('[!ghost]').filter((edge) =>
        nodeGnIds.has(asGnId(edge.source().id())) && nodeGnIds.has(asGnId(edge.target().id()))
      ).removeClass('query-dimmed').addClass('query-match');
    }
  }

  clearHighlight(): void {
    this.cy.elements().removeClass('query-match query-dimmed');
  }

  // ── Private refresh helpers ─────────────────────────────────────────────────

  /** Full clear + rebuild. Used only on initial load or after import. */
  private fullRefresh(nodes: RawNode[], edges: RawEdge[], savedPositions: PositionMap): void {
    const cy = this.cy;
    cy.elements().remove();

    const internalIdToGnId = new Map<string, GnId>(
      nodes.map((n) => [n._id, n._properties['gnId'] as GnId]),
    );

    const elements: cytoscape.ElementDefinition[] = [];
    const newNodeGnIds: GnId[] = [];

    for (const node of nodes) {
      const gnId = node._properties['gnId'] as GnId | undefined;
      if (!gnId) continue;
      const { displayLabel, color } = nodeDisplayData(node, this.registry);
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
      const def = edgeElementDef(edge, internalIdToGnId);
      if (def) elements.push(def);
    }

    cy.add(elements);
    this.placeNewNodes(newNodeGnIds);
  }

  /** Incremental diff: add/remove/update only changed elements. Positions are preserved. */
  private diffRefresh(nodes: RawNode[], edges: RawEdge[]): void {
    const cy = this.cy;

    const desiredNodes = new Map<GnId, RawNode>();
    for (const n of nodes) {
      const gnId = n._properties['gnId'] as GnId | undefined;
      if (gnId) desiredNodes.set(gnId, n);
    }

    const desiredEdges = new Map<GnId, RawEdge>();
    for (const e of edges) {
      const gnId = e._properties['gnId'] as GnId | undefined;
      if (gnId) desiredEdges.set(gnId, e);
    }

    // Map from WasmGraph internal _id (ephemeral) to stable gnId, for edge src/dst lookup
    const internalIdToGnId = new Map<string, GnId>(
      nodes.map((n) => [n._id, n._properties['gnId'] as GnId]),
    );

    // ── Nodes ──────────────────────────────────────────────────────────────────
    const existingNodeIds = new Set<GnId>();
    cy.nodes('[!ghost][!edgeHandle]').forEach((n) => {
      const gnId = asGnId(n.data('gnId') as string);
      existingNodeIds.add(gnId);
      if (!desiredNodes.has(gnId)) {
        n.remove();
      } else {
        const rawNode = desiredNodes.get(gnId)!;
        const { displayLabel, color } = nodeDisplayData(rawNode, this.registry);
        n.data({ displayLabel, nodeLabel: rawNode._labels[0] ?? '', color, borderColor: color });
      }
    });

    const newNodeGnIds: GnId[] = [];
    const newNodeElements: cytoscape.ElementDefinition[] = [];
    for (const [gnId, rawNode] of desiredNodes) {
      if (existingNodeIds.has(gnId)) continue;
      const { displayLabel, color } = nodeDisplayData(rawNode, this.registry);
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

    // ── Edges ──────────────────────────────────────────────────────────────────
    cy.edges('[!ghost]').forEach((e) => {
      if (!desiredEdges.has(asGnId(e.data('gnId') as string))) e.remove();
    });

    const existingEdgeIds = new Set<GnId>(
      cy.edges('[!ghost]').map((e) => asGnId(e.data('gnId') as string)),
    );
    const newEdgeElements: cytoscape.ElementDefinition[] = [];
    for (const [gnId, rawEdge] of desiredEdges) {
      if (existingEdgeIds.has(gnId)) continue;
      const def = edgeElementDef(rawEdge, internalIdToGnId);
      if (def) newEdgeElements.push(def);
    }
    if (newEdgeElements.length > 0) cy.add(newEdgeElements);
  }

  private placeNewNodes(gnIds: GnId[]): void {
    if (gnIds.length === 0) return;
    const cy = this.cy;
    const occupied = cy.nodes('[!ghost][!edgeHandle]').map((n) => n.position());
    const selector = gnIds.map((id) => `#${CSS.escape(id)}`).join(', ');
    cy.$(selector).forEach((n) => {
      const pos = findFreePosition(occupied);
      n.position(pos);
      occupied.push(pos);
    });
  }
}
