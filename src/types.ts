/**
 * Stable application-level identifier stored as a node/edge property.
 * Survives WasmGraph resets; used everywhere outside DB internals.
 * Contrast with `_id` which is an ephemeral internal WasmGraph integer
 * that resets on every graph reload.
 */
export type GnId = string & { readonly __brand: 'GnId' };
export function asGnId(s: string): GnId { return s as GnId; }

export interface RawNode {
  _id: string;
  _labels: string[];
  _properties: Record<string, string | number | boolean | null>;
}

export interface RawEdge {
  _id: string;
  _type: string;
  _src: string;
  _dst: string;
  _properties: Record<string, string | number | boolean | null>;
}

export type PropertyValue = string | number | boolean | null;

export interface PersistedNode {
  id: GnId;
  labels: string[];
  properties: Record<string, PropertyValue>;
}

export interface PersistedEdge {
  id: GnId;
  type: string;
  srcId: GnId;
  dstId: GnId;
  properties: Record<string, PropertyValue>;
}

export interface PersistedGraph {
  version: 1;
  nodes: PersistedNode[];
  edges: PersistedEdge[];
  positions: Record<GnId, { x: number; y: number }>;
}

export type InteractionMode = 'edit' | 'node';

export type TabKind = 'graph' | 'notebook';

// ── Notebook cell types ────────────────────────────────────────────────────────

export type NotebookCellKind = 'markdown' | 'query-result' | 'snapshot';

interface NotebookCellBase {
  id: string;
  kind: NotebookCellKind;
  createdAt: number;
}

export interface MarkdownCell extends NotebookCellBase {
  kind: 'markdown';
  content: string;
}

export interface QueryResultCell extends NotebookCellBase {
  kind: 'query-result';
  query: string;
  rows: Record<string, unknown>[];
  elapsedMs: number;
}

export interface SnapshotCell extends NotebookCellBase {
  kind: 'snapshot';
  label: string;
  positions: Record<GnId, { x: number; y: number }>;
  pngDataUrl: string;
}

export type NotebookCell = MarkdownCell | QueryResultCell | SnapshotCell;

export type CanvasEvent =
  | { kind: 'node-clicked'; gnId: GnId }
  | { kind: 'edge-clicked'; gnId: GnId }
  | { kind: 'canvas-clicked'; position: { x: number; y: number } }
  | { kind: 'edge-created'; sourceGnId: GnId; targetGnId: GnId }
  | { kind: 'edge-drag-cancelled' }
  | { kind: 'node-context'; gnId: GnId; x: number; y: number }
  | { kind: 'edge-context'; gnId: GnId; x: number; y: number }
  | { kind: 'bg-context'; x: number; y: number };
