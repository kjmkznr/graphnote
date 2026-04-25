import { WasmGraph } from '@kjmkznr/egrph-wasm';
import type { GnId, PropertyValue, RawEdge, RawNode } from '../types.js';
import { asGnId } from '../types.js';
import { assertIdentifier, escStr } from '../utils/graphUtils.js';

export interface IGraphExecutor {
  execute(cypher: string): string;
  exportCypher(): string;
  nodeCount(): number;
  edgeCount(): number;
  reset(): void;
}

class WasmGraphExecutor implements IGraphExecutor {
  constructor(private graph: WasmGraph) {}
  execute(cypher: string): string {
    return this.graph.execute(cypher);
  }
  exportCypher(): string {
    return this.graph.exportCypher();
  }
  nodeCount(): number {
    return this.graph.nodeCount();
  }
  edgeCount(): number {
    return this.graph.edgeCount();
  }
  reset(): void {
    this.graph = new WasmGraph();
  }
}

function propValueToCypher(v: PropertyValue): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return `"${escStr(v)}"`;
}

function buildPropsString(props: Record<string, PropertyValue>): string {
  return Object.entries(props)
    .map(([k, v]) => {
      assertIdentifier(k);
      return `${k}: ${propValueToCypher(v)}`;
    })
    .join(', ');
}

export class GraphDB {
  private executor!: IGraphExecutor;
  private _cachedNodes: RawNode[] | null = null;
  private _cachedEdges: RawEdge[] | null = null;
  private _bulkLoading = false;

  async init(): Promise<void> {
    this.executor = new WasmGraphExecutor(new WasmGraph());
  }

  setExecutor(executor: IGraphExecutor): void {
    this.executor = executor;
  }

  execute<T = unknown>(cypher: string): T[] {
    const json = this.executor.execute(cypher);
    return JSON.parse(json) as T[];
  }

  exportCypher(): string {
    return this.executor.exportCypher();
  }

  invalidateCache(): void {
    if (this._bulkLoading) return;
    this._cachedNodes = null;
    this._cachedEdges = null;
  }

  /**
   * Suppress per-operation cache invalidation for bulk load operations.
   * Call endBulkLoad() when done to flush the cache once.
   */
  beginBulkLoad(): void {
    this._bulkLoading = true;
  }

  endBulkLoad(): void {
    this._bulkLoading = false;
    this._cachedNodes = null;
    this._cachedEdges = null;
  }

  /**
   * Execute raw Cypher without cache invalidation (for internal bulk operations).
   * The caller is responsible for calling endBulkLoad() or invalidateCache() afterwards.
   */
  executeRaw(cypher: string): void {
    this.executor.execute(cypher);
  }

  getAllNodes(): RawNode[] {
    if (!this._cachedNodes) {
      const rows = this.execute<{ n: RawNode }>('MATCH (n) RETURN n');
      const seen = new Set<string>();
      this._cachedNodes = rows
        .map((r) => r.n)
        .filter((n) => {
          const gnId = n._properties.gnId as string | undefined;
          if (!gnId || seen.has(gnId)) return false;
          seen.add(gnId);
          return true;
        });
    }
    return this._cachedNodes;
  }

  getAllEdges(): RawEdge[] {
    if (!this._cachedEdges) {
      const rows = this.execute<{ r: RawEdge }>('MATCH ()-[r]->() RETURN r');
      const seen = new Set<string>();
      this._cachedEdges = rows
        .map((r) => r.r)
        .filter((e) => {
          const gnId = e._properties.gnId as string | undefined;
          if (!gnId || seen.has(gnId)) return false;
          seen.add(gnId);
          return true;
        });
    }
    return this._cachedEdges;
  }

  /**
   * Create a node. A stable gnId (UUID) is stored as a property so nodes
   * can be referenced even after the WasmGraph is recreated from localStorage.
   * Returns the gnId of the created node.
   */
  createNode(label: string, extraProps: Record<string, PropertyValue> = {}): GnId {
    const gnId = asGnId(crypto.randomUUID());
    this.createNodeWithGnId(label, gnId, extraProps);
    return gnId;
  }

  /**
   * Create a node with a specific gnId (used when restoring from localStorage).
   */
  createNodeWithGnId(
    label: string,
    gnId: GnId,
    extraProps: Record<string, PropertyValue> = {},
  ): void {
    assertIdentifier(label);
    const allProps: Record<string, PropertyValue> = {
      ...extraProps,
      gnId: gnId,
    };
    const propsStr = buildPropsString(allProps);
    this.executor.execute(`CREATE (:${label} {${propsStr}})`);
    this.invalidateCache();
  }

  /**
   * Create an edge with a specific gnId (used when restoring from localStorage).
   */
  createEdgeWithGnId(
    srcGnId: GnId,
    dstGnId: GnId,
    type: string,
    gnId: GnId,
    extraProps: Record<string, PropertyValue> = {},
  ): void {
    assertIdentifier(type);
    const allProps: Record<string, PropertyValue> = {
      ...extraProps,
      gnId: gnId,
    };
    const propsStr = buildPropsString(allProps);
    this.executor.execute(
      `MATCH (a), (b) WHERE a.gnId = "${escStr(srcGnId)}" AND b.gnId = "${escStr(dstGnId)}" ` +
        `CREATE (a)-[:${type} {${propsStr}}]->(b)`,
    );
    this.invalidateCache();
  }

  /**
   * Create an edge between two nodes identified by their gnId.
   * Returns the edge's gnId.
   */
  createEdge(
    srcGnId: GnId,
    dstGnId: GnId,
    type: string,
    extraProps: Record<string, PropertyValue> = {},
  ): GnId {
    const gnId = asGnId(crypto.randomUUID());
    this.createEdgeWithGnId(srcGnId, dstGnId, type, gnId, extraProps);
    return gnId;
  }

  /**
   * Change a node's label (type). Removes the old label and sets the new one.
   */
  relabelNode(gnId: GnId, oldLabel: string, newLabel: string): void {
    assertIdentifier(oldLabel);
    assertIdentifier(newLabel);
    this.executor.execute(
      `MATCH (n) WHERE n.gnId = "${escStr(gnId)}" REMOVE n:${oldLabel} SET n:${newLabel}`,
    );
    this.invalidateCache();
  }

  /** Update a single property on a node identified by gnId. */
  updateNodeProperty(gnId: GnId, key: string, value: PropertyValue): void {
    assertIdentifier(key);
    const val = propValueToCypher(value);
    this.executor.execute(`MATCH (n) WHERE n.gnId = "${escStr(gnId)}" SET n.${key} = ${val}`);
    this.invalidateCache();
  }

  /** Update a single property on an edge identified by gnId. */
  updateEdgeProperty(gnId: GnId, key: string, value: PropertyValue): void {
    assertIdentifier(key);
    const val = propValueToCypher(value);
    this.executor.execute(
      `MATCH ()-[r]->() WHERE r.gnId = "${escStr(gnId)}" SET r.${key} = ${val}`,
    );
    this.invalidateCache();
  }

  /** Delete a node (and its connected edges) identified by gnId. */
  deleteNode(gnId: GnId): void {
    // DETACH DELETE removes the node and all its connected edges in one query.
    this.executor.execute(`MATCH (n) WHERE n.gnId = "${escStr(gnId)}" DETACH DELETE n`);
    this.invalidateCache();
  }

  /** Delete an edge identified by gnId. */
  deleteEdge(gnId: GnId): void {
    try {
      this.executor.execute(`MATCH ()-[r]->() WHERE r.gnId = "${escStr(gnId)}" DELETE r`);
      this.invalidateCache();
    } catch (err) {
      console.warn('[db] deleteEdge failed', { gnId, err });
    }
  }

  getNodeByGnId(gnId: GnId): RawNode | null {
    try {
      const rows = this.execute<{ n: RawNode }>(
        `MATCH (n) WHERE n.gnId = "${escStr(gnId)}" RETURN n`,
      );
      return rows[0]?.n ?? null;
    } catch (err) {
      console.warn('[db] getNodeByGnId failed', { gnId, err });
      return null;
    }
  }

  getEdgeByGnId(gnId: GnId): RawEdge | null {
    try {
      const rows = this.execute<{ r: RawEdge }>(
        `MATCH ()-[r]->() WHERE r.gnId = "${escStr(gnId)}" RETURN r`,
      );
      return rows[0]?.r ?? null;
    } catch (err) {
      console.warn('[db] getEdgeByGnId failed', { gnId, err });
      return null;
    }
  }

  nodeCount(): number {
    return this.executor.nodeCount();
  }

  edgeCount(): number {
    return this.executor.edgeCount();
  }

  reset(): void {
    this.executor.reset();
    this.invalidateCache();
  }
}
