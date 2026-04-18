import { DEFAULT_NODE_COLORS } from '../utils/colors';
import { BaseTypeRegistry } from './baseTypeRegistry.js';

export type NodeShape =
  | 'ellipse'
  | 'rectangle'
  | 'round-rectangle'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'star';

export interface NodeTypeStyle {
  color: string;
  shape: NodeShape;
}

const DEFAULT_SHAPES: NodeShape[] = [
  'ellipse',
  'rectangle',
  'diamond',
  'round-rectangle',
  'hexagon',
  'triangle',
];

const DEFAULT_TYPES = ['Company', 'Person', 'System', 'Service', 'Concept', 'Note'];

export class TypeRegistry extends BaseTypeRegistry<NodeTypeStyle> {
  constructor() {
    super('graphnote:types', 'graphnote:node-type-styles', DEFAULT_TYPES);
  }

  protected validateStyle(v: unknown): v is NodeTypeStyle {
    return (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof (v as Record<string, unknown>).color === 'string' &&
      typeof (v as Record<string, unknown>).shape === 'string'
    );
  }

  protected defaultStyleForIndex(i: number): NodeTypeStyle {
    return {
      color: DEFAULT_NODE_COLORS[i % DEFAULT_NODE_COLORS.length] ?? '#6c8ef7',
      shape: DEFAULT_SHAPES[i % DEFAULT_SHAPES.length] ?? 'ellipse',
    };
  }

  protected defaultStyle(): NodeTypeStyle {
    return { color: '#6c8ef7', shape: 'ellipse' };
  }
}
