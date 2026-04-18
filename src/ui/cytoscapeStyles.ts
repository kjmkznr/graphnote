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

export const CYTOSCAPE_STYLES: cytoscape.StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      label: 'data(displayLabel)',
      color: '#fff',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'font-family': 'ui-monospace, monospace',
      width: 56,
      height: 56,
      'text-wrap': 'wrap',
      'text-max-width': '64px',
      'border-width': 2,
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
      'border-color': '#fff',
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
      width: 2,
      'line-color': '#4a5568',
      'target-arrow-color': '#4a5568',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      label: 'data(label)',
      'font-size': '10px',
      'font-family': 'ui-monospace, monospace',
      color: '#8892a4',
      'text-background-color': '#0f1117',
      'text-background-opacity': 1,
      'text-background-padding': '2px',
    },
  },
  {
    selector: 'edge:selected',
    style: {
      'line-color': '#6c8ef7',
      'target-arrow-color': '#6c8ef7',
      color: '#e2e8f0',
    },
  },
  {
    selector: 'edge[?ghost]',
    style: {
      width: 2,
      'line-color': '#6c8ef7',
      'target-arrow-color': '#6c8ef7',
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
      'background-color': '#6c8ef7',
      'border-width': 0,
      label: 'data(arrowLabel)',
      color: '#fff',
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
      'background-color': '#a78bfa',
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
      'border-color': '#fbbf24',
      'background-color': 'data(color)',
    },
  },
  {
    selector: 'edge.query-match',
    style: {
      'line-color': '#fbbf24',
      'target-arrow-color': '#fbbf24',
      width: 3,
      color: '#fbbf24',
    },
  },
];
