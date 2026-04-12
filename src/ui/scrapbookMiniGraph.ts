import cytoscape from 'cytoscape';
import type { RawNode, RawEdge } from '../types.js';
import { el } from './domUtils.js';
import { DEFAULT_NODE_COLORS } from '../utils/colors.js';
import { CYTOSCAPE_STYLES } from './cytoscapeStyles.js';

/**
 * ノードとエッジのリストからミニ Cytoscape グラフセクションを生成する。
 */
export function buildMiniGraph(nodes: RawNode[], edges: RawEdge[]): HTMLElement {
  const section = el('div', { class: 'nb-graph-section' });
  const container = el('div', { class: 'nb-graph-container' });
  section.appendChild(container);

  // Cytoscape は要素が DOM に追加された後に初期化する必要があるため requestAnimationFrame を使用
  requestAnimationFrame(() => {
    const PALETTE = DEFAULT_NODE_COLORS;
    const labelColors = new Map<string, string>();
    let paletteIdx = 0;
    const colorForLabel = (label: string): string => {
      if (!labelColors.has(label)) {
        labelColors.set(label, PALETTE[paletteIdx % PALETTE.length] ?? '#6c8ef7');
        paletteIdx++;
      }
      return labelColors.get(label)!;
    };

    const nodeElements: cytoscape.ElementDefinition[] = nodes.map(n => {
      const label = n._labels[0] ?? '';
      const name = (n._properties['name'] as string | undefined) ?? (label || String(n._properties['gnId'] ?? n._id).slice(0, 8));
      const color = colorForLabel(label);
      return {
        group: 'nodes' as const,
        data: {
          id: n._id,
          displayLabel: `${name}\n:${label}`,
          color,
          borderColor: color,
        },
      };
    });

    const nodeIds = new Set(nodes.map(n => n._id));
    const edgeElements: cytoscape.ElementDefinition[] = edges
      .filter(e => nodeIds.has(e._src) && nodeIds.has(e._dst))
      .map(e => ({
        group: 'edges' as const,
        data: {
          id: `e-${e._id}`,
          source: e._src,
          target: e._dst,
          label: e._type,
        },
      }));

    const cy = cytoscape({
      container,
      style: CYTOSCAPE_STYLES,
      elements: [...nodeElements, ...edgeElements],
      layout: { name: 'cose', animate: false } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cy.fit(undefined, 30);
  });

  return section;
}
