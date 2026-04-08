import { WasmGraph } from '@kjmkznr/egrph-wasm';
import { asGnId } from '../types.js';
import type { GnId, RawNode, RawEdge, PropertyValue } from '../types.js';
import { escStr } from '../utils/graphUtils.js';

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
    .map(([k, v]) => `${k}: ${propValueToCypher(v)}`)
    .join(', ');
}

export class GraphDB {
  private executor!: IGraphExecutor;

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

  getAllNodes(): RawNode[] {
    const rows = this.execute<{ n: RawNode }>('MATCH (n) RETURN n');
    return rows.map((r) => r.n);
  }

  getAllEdges(): RawEdge[] {
    const rows = this.execute<{ r: RawEdge }>('MATCH ()-[r]->() RETURN r');
    return rows.map((r) => r.r);
  }

  /**
   * Create a node. A stable gnId (UUID) is stored as a property so nodes
   * can be referenced even after the WasmGraph is recreated from localStorage.
   * Returns the gnId of the created node.
   */
  createNode(label: string, extraProps: Record<string, PropertyValue> = {}): GnId {
    const gnId = asGnId(crypto.randomUUID());
    const allProps: Record<string, PropertyValue> = {
      ...extraProps,
      gnId: gnId,
    };
    const propsStr = buildPropsString(allProps);
    this.executor.execute(`CREATE (:${label} {${propsStr}})`);
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
    const allProps: Record<string, PropertyValue> = { ...extraProps, gnId: gnId };
    const propsStr = buildPropsString(allProps);
    this.executor.execute(`CREATE (:${label} {${propsStr}})`);
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
    const allProps: Record<string, PropertyValue> = { ...extraProps, gnId: gnId };
    const propsStr = buildPropsString(allProps);
    this.executor.execute(
      `MATCH (a), (b) WHERE a.gnId = "${escStr(srcGnId)}" AND b.gnId = "${escStr(dstGnId)}" ` +
        `CREATE (a)-[:${type} {${propsStr}}]->(b)`,
    );
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
    const allProps: Record<string, PropertyValue> = { ...extraProps, gnId: gnId };
    const propsStr = buildPropsString(allProps);
    this.executor.execute(
      `MATCH (a), (b) WHERE a.gnId = "${escStr(srcGnId)}" AND b.gnId = "${escStr(dstGnId)}" ` +
        `CREATE (a)-[:${type} {${propsStr}}]->(b)`,
    );
    return gnId;
  }

  /**
   * Change a node's label (type). Removes the old label and sets the new one.
   */
  relabelNode(gnId: GnId, oldLabel: string, newLabel: string): void {
    this.executor.execute(
      `MATCH (n) WHERE n.gnId = "${escStr(gnId)}" REMOVE n:${oldLabel} SET n:${newLabel}`,
    );
  }

  /** Update a single property on a node identified by gnId. */
  updateNodeProperty(gnId: GnId, key: string, value: PropertyValue): void {
    const val = propValueToCypher(value);
    this.executor.execute(
      `MATCH (n) WHERE n.gnId = "${escStr(gnId)}" SET n.${key} = ${val}`,
    );
  }

  /** Update a single property on an edge identified by gnId. */
  updateEdgeProperty(gnId: GnId, key: string, value: PropertyValue): void {
    const val = propValueToCypher(value);
    this.executor.execute(
      `MATCH ()-[r]->() WHERE r.gnId = "${escStr(gnId)}" SET r.${key} = ${val}`,
    );
  }

  /** Delete a node (and its connected edges) identified by gnId. */
  deleteNode(gnId: GnId): void {
    // Delete incoming/outgoing edges first
    try {
      this.executor.execute(
        `MATCH (n)-[r]-() WHERE n.gnId = "${escStr(gnId)}" DELETE r`,
      );
    } catch {
      // no edges — fine
    }
    try {
      this.executor.execute(
        `MATCH (n) WHERE n.gnId = "${escStr(gnId)}" DELETE n`,
      );
    } catch {
      // already gone
    }
  }

  /** Delete an edge identified by gnId. */
  deleteEdge(gnId: GnId): void {
    try {
      this.executor.execute(
        `MATCH ()-[r]->() WHERE r.gnId = "${escStr(gnId)}" DELETE r`,
      );
    } catch {
      // already gone
    }
  }

  getNodeByGnId(gnId: GnId): RawNode | null {
    try {
      const rows = this.execute<{ n: RawNode }>(
        `MATCH (n) WHERE n.gnId = "${escStr(gnId)}" RETURN n`,
      );
      return rows[0]?.n ?? null;
    } catch {
      return null;
    }
  }

  getEdgeByGnId(gnId: GnId): RawEdge | null {
    try {
      const rows = this.execute<{ r: RawEdge }>(
        `MATCH ()-[r]->() WHERE r.gnId = "${escStr(gnId)}" RETURN r`,
      );
      return rows[0]?.r ?? null;
    } catch {
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
  }
}
