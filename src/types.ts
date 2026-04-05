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
  id: string;
  labels: string[];
  properties: Record<string, PropertyValue>;
}

export interface PersistedEdge {
  id: string;
  type: string;
  srcId: string;
  dstId: string;
  properties: Record<string, PropertyValue>;
}

export interface PersistedGraph {
  version: 1;
  nodes: PersistedNode[];
  edges: PersistedEdge[];
  positions: Record<string, { x: number; y: number }>;
}

export type InteractionMode = 'select' | 'node' | 'edge';

export type CanvasEvent =
  | { kind: 'node-clicked'; gnId: string }
  | { kind: 'edge-clicked'; gnId: string }
  | { kind: 'canvas-clicked'; position: { x: number; y: number } }
  | { kind: 'edge-created'; sourceGnId: string; targetGnId: string }
  | { kind: 'node-context'; gnId: string; x: number; y: number }
  | { kind: 'edge-context'; gnId: string; x: number; y: number }
  | { kind: 'bg-context'; x: number; y: number };
