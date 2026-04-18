import type { GraphDB } from './db.js';
import { asGnId } from '../types.js';
import type { GnId, PersistedGraph, RawNode, RawEdge } from '../types.js';

import { openGraphnoteDB } from './idb.js';

const STORAGE_KEY = 'graphnote:v1';
const IDB_STORE_NAME = 'graphs';
const IDB_META_STORE_NAME = 'graph-meta';

export interface GraphMeta {
  id: string;
  name: string;
  createdAt: number;
}

/**
 * Serialize nodes and edges into a PersistedGraph.
 * Builds an internal-id → gnId map upfront so edge src/dst lookup is O(1)
 * rather than O(n) per edge.
 */
function buildPersistedGraph(
  nodes: RawNode[],
  edges: RawEdge[],
  positions: Record<GnId, { x: number; y: number }>,
  viewport?: { pan: { x: number; y: number }; zoom: number },
): PersistedGraph {
  // Map from WasmGraph internal _id (ephemeral) to stable gnId
  const internalIdToGnId = new Map<string, GnId>(
    nodes
      .map((n) => [n._id, n._properties['gnId'] as GnId | undefined] as const)
      .filter((entry): entry is [string, GnId] => entry[1] !== undefined),
  );

  return {
    version: 1,
    nodes: nodes
      .filter((n) => n._properties['gnId'] !== undefined)
      .map((n) => ({
        id: n._properties['gnId'] as GnId,
        labels: n._labels,
        properties: n._properties,
      })),
    edges: edges
      .map((e) => ({
        id: e._properties['gnId'] as GnId,
        type: e._type,
        srcId: internalIdToGnId.get(e._src) ?? asGnId(''),
        dstId: internalIdToGnId.get(e._dst) ?? asGnId(''),
        properties: e._properties,
      }))
      .filter((e) => e.id && e.srcId && e.dstId),
    positions,
    viewport,
  };
}

export interface IStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface IAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class BrowserStorage implements IStorage {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}

export class IndexedDBStorage implements IAsyncStorage {
  private openDB(): Promise<IDBDatabase> {
    return openGraphnoteDB();
  }

  async getItem(key: string): Promise<string | null> {
    const db = await this.openDB();
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const req = tx.objectStore(IDB_STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const req = tx.objectStore(IDB_STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async listGraphMeta(): Promise<GraphMeta[]> {
    const db = await this.openDB();
    return new Promise<GraphMeta[]>((resolve, reject) => {
      const tx = db.transaction(IDB_META_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_META_STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as GraphMeta[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error);
    });
  }

  async putGraphMeta(meta: GraphMeta): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_META_STORE_NAME, 'readwrite');
      const req = tx.objectStore(IDB_META_STORE_NAME).put(meta);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteGraphMeta(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_META_STORE_NAME, 'readwrite');
      const req = tx.objectStore(IDB_META_STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/**
 * Migrate data from localStorage to IndexedDB if localStorage has data and IndexedDB does not.
 */
export async function migrateFromLocalStorage(storage: IAsyncStorage = new IndexedDBStorage()): Promise<void> {
  const existing = await storage.getItem(STORAGE_KEY);
  if (existing) return;

  const localData = localStorage.getItem(STORAGE_KEY);
  if (!localData) return;

  try {
    await storage.setItem(STORAGE_KEY, localData);
    localStorage.removeItem(STORAGE_KEY);
    console.info('Migrated graph data from localStorage to IndexedDB');
  } catch (err) {
    console.warn('Failed to migrate from localStorage to IndexedDB:', err);
  }
}

export async function saveGraph(
  db: GraphDB,
  positions: Record<GnId, { x: number; y: number }>,
  viewport?: { pan: { x: number; y: number }; zoom: number },
  storage: IAsyncStorage = new IndexedDBStorage(),
  graphId?: string,
): Promise<void> {
  const nodes = db.getAllNodes();
  const edges = db.getAllEdges();
  const data = buildPersistedGraph(nodes, edges, positions, viewport);
  const key = graphId ? `graph:${graphId}` : STORAGE_KEY;

  try {
    await storage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save to storage:', err);
  }
}

export async function loadGraph(
  db: GraphDB,
  storage: IAsyncStorage = new IndexedDBStorage(),
  graphId?: string,
): Promise<{ positions: Record<GnId, { x: number; y: number }>; viewport?: { pan: { x: number; y: number }; zoom: number } }> {
  const key = graphId ? `graph:${graphId}` : STORAGE_KEY;
  const raw = await storage.getItem(key);
  if (!raw) return { positions: {} };

  let saved: PersistedGraph;
  try {
    saved = JSON.parse(raw) as PersistedGraph;
  } catch {
    return { positions: {} };
  }

  if (saved.version !== 1) return { positions: {} };

  db.reset();
  restoreNodes(db, saved.nodes);
  restoreEdges(db, saved.edges);

  return { positions: saved.positions ?? {} as Record<GnId, { x: number; y: number }>, viewport: saved.viewport };
}

export async function clearSaved(storage: IAsyncStorage = new IndexedDBStorage(), graphId?: string): Promise<void> {
  const key = graphId ? `graph:${graphId}` : STORAGE_KEY;
  await storage.removeItem(key);
}

export function exportToFile(
  db: GraphDB,
  positions: Record<GnId, { x: number; y: number }>,
): void {
  const nodes = db.getAllNodes();
  const edges = db.getAllEdges();
  const data = buildPersistedGraph(nodes, edges, positions);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
  a.download = `graphnote-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}


export function exportToCypher(
  db: GraphDB,
  positions: Record<GnId, { x: number; y: number }>,
): void {
  const baseCypher = db.exportCypher();
  if (!baseCypher) return;

  // Append position comments to each node line
  const lines = baseCypher.split('\n');
  const processedLines = lines.map(line => {
    // Look for gnId: "..." in the line
    const match = line.match(/gnId: "([^"]+)"/);
    if (match && match[1]) {
      const gnId = asGnId(match[1]);
      const pos = positions[gnId];
      if (pos) {
        return `${line} // position: {"x": ${pos.x}, "y": ${pos.y}}`;
      }
    }
    return line;
  });

  let cypher = '// Graphnote Cypher Export\n';
  cypher += `// Generated: ${new Date().toISOString()}\n\n`;
  cypher += processedLines.join('\n');

  const blob = new Blob([cypher], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace(/[T:]/g, '-');
  a.download = `graphnote-${ts}.cypher`;
  a.click();
  URL.revokeObjectURL(url);
}

function restoreNodes(db: GraphDB, nodes: PersistedGraph['nodes']): void {
  for (const pNode of nodes) {
    if (!pNode.id || !pNode.labels[0]) continue;
    const label = pNode.labels[0];
    const props: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(pNode.properties)) {
      if (k !== 'gnId') props[k] = v;
    }
    try {
      db.createNodeWithGnId(label, asGnId(pNode.id), props);
    } catch (err) {
      console.warn('Failed to restore node:', err);
    }
  }
}

function restoreEdges(db: GraphDB, edges: PersistedGraph['edges']): void {
  for (const pEdge of edges) {
    if (!pEdge.srcId || !pEdge.dstId) continue;
    const props: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(pEdge.properties)) {
      if (k !== 'gnId') props[k] = v;
    }
    try {
      db.createEdgeWithGnId(asGnId(pEdge.srcId), asGnId(pEdge.dstId), pEdge.type, asGnId(pEdge.id), props);
    } catch (err) {
      console.warn('Failed to restore edge:', err);
    }
  }
}

export function loadFromJson(db: GraphDB, json: string): { positions: Record<GnId, { x: number; y: number }> } | null {
  let saved: PersistedGraph;
  try {
    saved = JSON.parse(json) as PersistedGraph;
  } catch {
    return null;
  }

  if (saved.version !== 1 || !Array.isArray(saved.nodes) || !Array.isArray(saved.edges)) {
    return null;
  }

  db.reset();
  restoreNodes(db, saved.nodes);
  restoreEdges(db, saved.edges);

  return { positions: saved.positions ?? {} as Record<GnId, { x: number; y: number }> };
}
