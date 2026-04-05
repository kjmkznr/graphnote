import type { GraphDB } from './db.js';
import type { PersistedGraph } from '../types.js';

const STORAGE_KEY = 'graphnote:v1';

export function saveGraph(
  db: GraphDB,
  positions: Record<string, { x: number; y: number }>,
): void {
  const nodes = db.getAllNodes();
  const edges = db.getAllEdges();

  const data: PersistedGraph = {
    version: 1,
    nodes: nodes.map((n) => ({
      id: n._properties['gnId'] as string,
      labels: n._labels,
      properties: n._properties,
    })),
    edges: edges.map((e) => {
      // Find gnIds for src/dst by looking at nodes
      const srcNode = nodes.find((n) => n._id === e._src);
      const dstNode = nodes.find((n) => n._id === e._dst);
      return {
        id: e._properties['gnId'] as string,
        type: e._type,
        srcId: srcNode?._properties['gnId'] as string ?? '',
        dstId: dstNode?._properties['gnId'] as string ?? '',
        properties: e._properties,
      };
    }).filter((e) => e.srcId && e.dstId),
    positions,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
}

export async function loadGraph(db: GraphDB): Promise<Record<string, { x: number; y: number }>> {
  const raw = localStorage.getItem(STORAGE_KEY);
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
    // Restore all properties (including gnId which is the stable key)
    const props: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(pNode.properties)) {
      if (k !== 'gnId') props[k] = v;
    }
    // Re-create node with the same gnId so edges can reference it
    try {
      db.createNodeWithGnId(label, pNode.id, props);
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
      db.createEdgeWithGnId(pEdge.srcId, pEdge.dstId, pEdge.type, pEdge.id, props);
    } catch (err) {
      console.warn('Failed to restore edge:', err);
    }
  }

  return saved.positions ?? {};
}

export function clearSaved(): void {
  localStorage.removeItem(STORAGE_KEY);
}
