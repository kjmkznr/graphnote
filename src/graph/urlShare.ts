import type { GraphDB } from "./db.js";
import { asGnId } from "../types.js";
import type { GnId, PersistedGraph } from "../types.js";

/**
 * Compress a string using DeflateRaw and return a base64url-encoded string.
 */
async function compressToBase64url(json: string): Promise<string> {
  const input = new TextEncoder().encode(json);
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  writer.write(input);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }

  // base64url: standard base64 with +→- /→_ and no trailing =
  let b64 = btoa(String.fromCharCode(...compressed));
  b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
}

/**
 * Decompress a base64url-encoded deflate-raw stream back to a string.
 */
async function decompressFromBase64url(b64url: string): Promise<string> {
  // Restore standard base64
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const decompressed = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    decompressed.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(decompressed);
}

/**
 * Build a shareable URL encoding the current graph state into the hash fragment.
 * Returns the full URL string or null if the graph is empty.
 */
export async function buildShareUrl(
  db: GraphDB,
  positions: Record<GnId, { x: number; y: number }>,
  viewport?: { pan: { x: number; y: number }; zoom: number },
): Promise<string | null> {
  const nodes = db.getAllNodes();
  if (nodes.length === 0) return null;

  const edges = db.getAllEdges();

  // Build the same PersistedGraph format used by persistence.ts
  const internalIdToGnId = new Map<string, GnId>(
    nodes
      .map((n) => [n._id, n._properties["gnId"] as GnId | undefined] as const)
      .filter((entry): entry is [string, GnId] => entry[1] !== undefined),
  );

  const graph: PersistedGraph = {
    version: 1,
    nodes: nodes
      .filter((n) => n._properties["gnId"] !== undefined)
      .map((n) => ({
        id: n._properties["gnId"] as GnId,
        labels: n._labels,
        properties: n._properties,
      })),
    edges: edges
      .map((e) => ({
        id: e._properties["gnId"] as GnId,
        type: e._type,
        srcId: internalIdToGnId.get(e._src) ?? asGnId(""),
        dstId: internalIdToGnId.get(e._dst) ?? asGnId(""),
        properties: e._properties,
      }))
      .filter((e) => e.id && e.srcId && e.dstId),
    positions,
    viewport,
  };

  const json = JSON.stringify(graph);
  const encoded = await compressToBase64url(json);

  const base = `${location.origin}${location.pathname}`;
  return `${base}#share=${encoded}`;
}

/**
 * Check the current URL hash for shared graph data.
 * Returns the decoded PersistedGraph or null if no share data is present.
 */
export async function parseShareUrl(): Promise<PersistedGraph | null> {
  const hash = location.hash;
  if (!hash.startsWith("#share=")) return null;

  const encoded = hash.slice("#share=".length);
  if (!encoded) return null;

  try {
    const json = await decompressFromBase64url(encoded);
    const data = JSON.parse(json) as PersistedGraph;
    if (
      data.version !== 1 ||
      !Array.isArray(data.nodes) ||
      !Array.isArray(data.edges)
    ) {
      return null;
    }
    return data;
  } catch (err) {
    console.warn("Failed to decode shared graph URL:", err);
    return null;
  }
}

/**
 * Restore a PersistedGraph into the database.
 * Returns positions and viewport for canvas restoration.
 */
export function restoreSharedGraph(
  db: GraphDB,
  graph: PersistedGraph,
): {
  positions: Record<GnId, { x: number; y: number }>;
  viewport?: { pan: { x: number; y: number }; zoom: number };
} {
  db.reset();

  for (const pNode of graph.nodes) {
    if (!pNode.id || !pNode.labels[0]) continue;
    const label = pNode.labels[0];
    const props: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(pNode.properties)) {
      if (k !== "gnId") props[k] = v;
    }
    try {
      db.createNodeWithGnId(label, asGnId(pNode.id), props);
    } catch (err) {
      console.warn("Failed to restore shared node:", err);
    }
  }

  for (const pEdge of graph.edges) {
    if (!pEdge.srcId || !pEdge.dstId) continue;
    const props: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(pEdge.properties)) {
      if (k !== "gnId") props[k] = v;
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
      console.warn("Failed to restore shared edge:", err);
    }
  }

  return {
    positions:
      graph.positions ?? ({} as Record<GnId, { x: number; y: number }>),
    viewport: graph.viewport,
  };
}
