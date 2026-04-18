import type cytoscape from 'cytoscape';
import type { EdgeTypeRegistry } from '../graph/edgeTypeRegistry.js';
import type { TypeRegistry } from '../graph/typeRegistry.js';

export function buildEdgeTypeStyles(edgeRegistry: EdgeTypeRegistry): cytoscape.StylesheetStyle[] {
  return edgeRegistry.getAll().map((type) => {
    const style = edgeRegistry.getStyle(type);
    const lineStyle =
      style.lineStyle === 'dotted' ? 'dotted' : style.lineStyle === 'dashed' ? 'dashed' : 'solid';
    return {
      selector: `edge[label="${CSS.escape(type)}"]`,
      style: {
        'line-color': style.color,
        'target-arrow-color': style.color,
        'line-style': lineStyle,
      },
    } as cytoscape.StylesheetStyle;
  });
}

export function buildNodeTypeStyles(registry: TypeRegistry): cytoscape.StylesheetStyle[] {
  return registry.getAll().map((type) => {
    const style = registry.getStyle(type);
    return {
      selector: `node[nodeLabel="${CSS.escape(type)}"]`,
      style: {
        'background-color': style.color,
        'border-color': style.color,
        shape: style.shape,
      },
    } as cytoscape.StylesheetStyle;
  });
}

// Design token approximations (oklch → hex for Cytoscape)
// --bg-0: oklch(0.14 0.005 240) ≈ #141920
// --accent (green): oklch(0.82 0.13 145) ≈ #4ec994
// --text: oklch(0.95 0.005 240) ≈ #eef0f5
// --text-mid: oklch(0.72 0.007 240) ≈ #a8afc0
// --text-dim: oklch(0.52 0.008 240) ≈ #6b7494
// --line-strong: oklch(0.34 0.008 240) ≈ #3e4560
const CY_BG = '#141920';
const CY_ACCENT = '#4ec994';
const CY_TEXT = '#eef0f5';
const CY_TEXT_MID = '#a8afc0';
const CY_TEXT_DIM = '#6b7494';
const CY_EDGE = '#3e4560';
const CY_HIGHLIGHT = '#f0b429'; // amber for query match

export const CYTOSCAPE_STYLES: cytoscape.StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      label: 'data(displayLabel)',
      color: CY_TEXT,
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'font-family': 'Geist Mono, ui-monospace, monospace',
      width: 52,
      height: 52,
      'text-wrap': 'wrap',
      'text-max-width': '60px',
      'border-width': 2,
      'border-color': CY_BG,
      'text-outline-color': CY_BG,
      'text-outline-width': 2,
    },
  },
  {
    selector: 'node[borderColor]',
    style: {
      'border-color': 'data(borderColor)',
    },
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': CY_ACCENT,
    },
  },
  {
    selector: 'node[?ghost]',
    style: {
      width: 10,
      height: 10,
      'background-color': 'transparent',
      'border-width': 0,
      label: '',
      events: 'no',
    },
  },
  {
    selector: 'edge',
    style: {
      width: 1.5,
      'line-color': CY_EDGE,
      'target-arrow-color': CY_EDGE,
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      label: 'data(label)',
      'font-size': '9.5px',
      'font-family': 'Geist Mono, ui-monospace, monospace',
      color: CY_TEXT_DIM,
      'text-background-color': CY_BG,
      'text-background-opacity': 1,
      'text-background-padding': '2px',
    },
  },
  {
    selector: 'edge:selected',
    style: {
      'line-color': CY_ACCENT,
      'target-arrow-color': CY_ACCENT,
      color: CY_TEXT_MID,
      width: 2,
    },
  },
  {
    selector: 'edge[?ghost]',
    style: {
      width: 2,
      'line-color': CY_ACCENT,
      'target-arrow-color': CY_ACCENT,
      'target-arrow-shape': 'triangle',
      'line-style': 'dashed',
      opacity: 0.6,
      events: 'no',
    },
  },
  {
    selector: 'node[?edgeHandle]',
    style: {
      width: 18,
      height: 18,
      shape: 'ellipse',
      'background-color': CY_ACCENT,
      'border-width': 0,
      label: 'data(arrowLabel)',
      color: CY_BG,
      'font-size': '11px',
      'text-valign': 'center',
      'text-halign': 'center',
      opacity: 0.9,
      'z-index': 999,
    },
  },
  {
    selector: 'node[?edgeHandle]:hover',
    style: {
      'background-color': CY_ACCENT,
      opacity: 1,
      width: 22,
      height: 22,
    },
  },
  {
    selector: '.query-dimmed',
    style: { opacity: 0.12 },
  },
  {
    selector: 'node.query-match',
    style: {
      'border-width': 3,
      'border-color': CY_HIGHLIGHT,
      'background-color': 'data(color)',
    },
  },
  {
    selector: 'edge.query-match',
    style: {
      'line-color': CY_HIGHLIGHT,
      'target-arrow-color': CY_HIGHLIGHT,
      width: 2.5,
      color: CY_HIGHLIGHT,
    },
  },
];
