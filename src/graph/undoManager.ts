import type { GnId, PersistedGraph, PropertyValue } from '../types.js';
import { asGnId } from '../types.js';
import type { GraphDB } from './db.js';

export interface GraphSnapshot {
  graph: PersistedGraph;
}

const MAX_UNDO_STACK = 100;

/**
 * Snapshot-based undo/redo manager.
 *
 * Captures the full graph state (nodes, edges, positions) before each
 * mutation. On undo/redo the entire graph is rebuilt from the snapshot,
 * which is simple and reliable — no per-operation inverse logic needed.
 */
export class UndoManager {
  private undoStack: GraphSnapshot[] = [];
  private redoStack: GraphSnapshot[] = [];
  private onChangeCb: (() => void) | null = null;

  onChange(cb: () => void): void {
    this.onChangeCb = cb;
  }

  /** Capture the current state and push it onto the undo stack. */
  pushState(snapshot: GraphSnapshot): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
    this.onChangeCb?.();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Undo: pops the last saved state, pushes the *current* state onto redo,
   * and returns the snapshot to restore.
   */
  undo(currentSnapshot: GraphSnapshot): GraphSnapshot | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(currentSnapshot);
    this.onChangeCb?.();
    return prev;
  }

  /**
   * Redo: pops the last undone state, pushes the *current* state onto undo,
   * and returns the snapshot to restore.
   */
  redo(currentSnapshot: GraphSnapshot): GraphSnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(currentSnapshot);
    this.onChangeCb?.();
    return next;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.onChangeCb?.();
  }

  // ── Snapshot helpers ──────────────────────────────────────────────────────

  static captureSnapshot(
    db: GraphDB,
    positions: Record<GnId, { x: number; y: number }>,
  ): GraphSnapshot {
    const nodes = db.getAllNodes();
    const edges = db.getAllEdges();

    const internalIdToGnId = new Map<string, GnId>(
      nodes
        .map((n) => [n._id, n._properties.gnId as GnId | undefined] as const)
        .filter((entry): entry is [string, GnId] => entry[1] !== undefined),
    );

    const graph: PersistedGraph = {
      version: 1,
      nodes: nodes
        .filter((n) => n._properties.gnId !== undefined)
        .map((n) => ({
          id: n._properties.gnId as GnId,
          labels: n._labels,
          properties: n._properties,
        })),
      edges: edges
        .map((e) => ({
          id: e._properties.gnId as GnId,
          type: e._type,
          srcId: internalIdToGnId.get(e._src) ?? asGnId(''),
          dstId: internalIdToGnId.get(e._dst) ?? asGnId(''),
          properties: e._properties,
        }))
        .filter((e) => e.id && e.srcId && e.dstId),
      positions: { ...positions },
    };

    return { graph };
  }

  static restoreSnapshot(
    db: GraphDB,
    snapshot: GraphSnapshot,
  ): Record<GnId, { x: number; y: number }> {
    const { graph } = snapshot;
    db.reset();

    for (const pNode of graph.nodes) {
      if (!pNode.id || !pNode.labels[0]) continue;
      const label = pNode.labels[0];
      const props: Record<string, PropertyValue> = {};
      for (const [k, v] of Object.entries(pNode.properties)) {
        if (k !== 'gnId') props[k] = v;
      }
      try {
        db.createNodeWithGnId(label, asGnId(pNode.id), props);
      } catch (err) {
        console.warn('Undo/redo: failed to restore node:', err);
      }
    }

    for (const pEdge of graph.edges) {
      if (!pEdge.srcId || !pEdge.dstId) continue;
      const props: Record<string, PropertyValue> = {};
      for (const [k, v] of Object.entries(pEdge.properties)) {
        if (k !== 'gnId') props[k] = v;
      }
      try {
        db.createEdgeWithGnId(
          asGnId(pEdge.srcId),
          asGnId(pEdge.dstId),
          pEdge.type,
          asGnId(pEdge.id),
          props,
        );
      } catch (err) {
        console.warn('Undo/redo: failed to restore edge:', err);
      }
    }

    return graph.positions ?? {};
  }
}
