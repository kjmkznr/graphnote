import type { GraphDB } from './db.js';
import { asGnId } from '../types.js';
import type { GnId, PersistedGraph, RawNode, RawEdge } from '../types.js';

const STORAGE_KEY = 'graphnote:v1';

/**
 * Serialize nodes and edges into a PersistedGraph.
 * Builds an internal-id → gnId map upfront so edge src/dst lookup is O(1)
 * rather than O(n) per edge.
 */
function buildPersistedGraph(
  nodes: RawNode[],
  edges: RawEdge[],
  positions: Record<GnId, { x: number; y: number }>,
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
  };
}

export interface IStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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

export function saveGraph(
  db: GraphDB,
  positions: Record<GnId, { x: number; y: number }>,
  storage: IStorage = new BrowserStorage()
): void {
  const nodes = db.getAllNodes();
  const edges = db.getAllEdges();
  const data = buildPersistedGraph(nodes, edges, positions);

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save to storage:', err);
  }
}

export async function loadGraph(
  db: GraphDB,
  storage: IStorage = new BrowserStorage()
): Promise<Record<GnId, { x: number; y: number }>> {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {};

  let saved: PersistedGraph;
  try {
    saved = JSON.parse(raw) as PersistedGraph;
  } catch {
    return {};
  }

  if (saved.version !== 1) return {};

  db.reset();

  for (const pNode of saved.nodes) {
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

  for (const pEdge of saved.edges) {
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

  return saved.positions ?? {} as Record<GnId, { x: number; y: number }>;
}

export function clearSaved(storage: IStorage = new BrowserStorage()): void {
  storage.removeItem(STORAGE_KEY);
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

export async function importFromFile(db: GraphDB): Promise<Record<GnId, { x: number; y: number }> | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }

      const reader = new FileReader();
      reader.onload = () => {
        let saved: PersistedGraph;
        try {
          saved = JSON.parse(reader.result as string) as PersistedGraph;
        } catch {
          resolve(null);
          return;
        }

        if (saved.version !== 1 || !Array.isArray(saved.nodes) || !Array.isArray(saved.edges)) {
          resolve(null);
          return;
        }

        db.reset();

        for (const pNode of saved.nodes) {
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

        for (const pEdge of saved.edges) {
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

        resolve(saved.positions ?? {} as Record<GnId, { x: number; y: number }>);
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });

    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
