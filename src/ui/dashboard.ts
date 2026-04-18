import type { RawEdge, RawNode } from '../types.js';
import { buildHBarChart, type HBarChartData, pickColor } from './charts.js';

function buildEmptyMessage(msg: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'db-empty';
  p.textContent = msg;
  return p;
}

function buildSection(title: string, content: HTMLElement | SVGSVGElement): HTMLElement {
  const section = document.createElement('div');
  section.className = 'db-section';

  const h = document.createElement('div');
  h.className = 'db-section-title';
  h.textContent = title;
  section.appendChild(h);

  section.appendChild(content);
  return section;
}

export class Dashboard {
  private root: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.className = 'dashboard-root';
  }

  refresh(nodes: RawNode[], edges: RawEdge[]): void {
    this.root.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'db-grid';

    // ── Summary cards ──────────────────────────────────────────────────────────
    const cards = document.createElement('div');
    cards.className = 'db-cards';

    cards.appendChild(this.buildCard('ノード数', String(nodes.length), '#6c8ef7'));
    cards.appendChild(this.buildCard('エッジ数', String(edges.length), '#a78bfa'));

    const nodeTypeSet = new Set(nodes.flatMap((n) => n._labels));
    cards.appendChild(this.buildCard('ノードタイプ数', String(nodeTypeSet.size), '#34d399'));

    const edgeTypeSet = new Set(edges.map((e) => e._type));
    cards.appendChild(this.buildCard('エッジタイプ数', String(edgeTypeSet.size), '#fbbf24'));

    grid.appendChild(cards);

    const sections = document.createElement('div');
    sections.className = 'db-sections';

    // ── Node type distribution ─────────────────────────────────────────────────
    const nodeTypeCounts = new Map<string, number>();
    for (const node of nodes) {
      for (const label of node._labels) {
        nodeTypeCounts.set(label, (nodeTypeCounts.get(label) ?? 0) + 1);
      }
    }
    const nodeTypeData: HBarChartData[] = [...nodeTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: pickColor(i) }));

    sections.appendChild(
      buildSection(
        'ノードタイプ別分布',
        nodeTypeData.length > 0
          ? buildHBarChart(nodeTypeData, 'ノードタイプ別分布')
          : buildEmptyMessage('ノードがありません'),
      ),
    );

    // ── Edge type distribution ─────────────────────────────────────────────────
    const edgeTypeCounts = new Map<string, number>();
    for (const edge of edges) {
      edgeTypeCounts.set(edge._type, (edgeTypeCounts.get(edge._type) ?? 0) + 1);
    }
    const edgeTypeData: HBarChartData[] = [...edgeTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: pickColor(i) }));

    sections.appendChild(
      buildSection(
        'エッジタイプ別分布',
        edgeTypeData.length > 0
          ? buildHBarChart(edgeTypeData, 'エッジタイプ別分布')
          : buildEmptyMessage('エッジがありません'),
      ),
    );

    // ── Degree distribution ────────────────────────────────────────────────────
    const internalIdToGnId = new Map<string, string>();
    for (const node of nodes) {
      const gnId = node._properties.gnId;
      if (typeof gnId === 'string') internalIdToGnId.set(node._id, gnId);
    }

    const gnIdDegree = new Map<string, number>();
    for (const node of nodes) {
      const gnId = node._properties.gnId;
      if (typeof gnId === 'string') gnIdDegree.set(gnId, 0);
    }
    for (const edge of edges) {
      const srcGnId = internalIdToGnId.get(edge._src);
      const dstGnId = internalIdToGnId.get(edge._dst);
      if (srcGnId) gnIdDegree.set(srcGnId, (gnIdDegree.get(srcGnId) ?? 0) + 1);
      if (dstGnId) gnIdDegree.set(dstGnId, (gnIdDegree.get(dstGnId) ?? 0) + 1);
    }

    const degreeBuckets = new Map<number, number>();
    for (const deg of gnIdDegree.values()) {
      degreeBuckets.set(deg, (degreeBuckets.get(deg) ?? 0) + 1);
    }
    const degreeData: HBarChartData[] = [...degreeBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([deg, count], i) => ({
        label: `接続数 ${deg}`,
        value: count,
        color: pickColor(i),
      }));

    sections.appendChild(
      buildSection(
        '接続数分布（ノード数）',
        degreeData.length > 0
          ? buildHBarChart(degreeData, '接続数分布')
          : buildEmptyMessage('ノードがありません'),
      ),
    );

    // ── Top connected nodes ────────────────────────────────────────────────────
    const topNodes: HBarChartData[] = [...gnIdDegree.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .filter(([, deg]) => deg > 0)
      .map(([gnId, deg], i) => {
        const node = nodes.find((n) => n._properties.gnId === gnId);
        const name = node ? String(node._properties.name ?? node._labels[0] ?? gnId) : gnId;
        return { label: name, value: deg, color: pickColor(i) };
      });

    sections.appendChild(
      buildSection(
        '接続数 Top 10 ノード',
        topNodes.length > 0
          ? buildHBarChart(topNodes, '接続数 Top 10 ノード')
          : buildEmptyMessage('エッジがありません'),
      ),
    );

    grid.appendChild(sections);
    this.root.appendChild(grid);
  }

  private buildCard(label: string, value: string, color: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'db-card';
    card.style.borderTopColor = color;

    const v = document.createElement('div');
    v.className = 'db-card-value';
    v.style.color = color;
    v.textContent = value;

    const l = document.createElement('div');
    l.className = 'db-card-label';
    l.textContent = label;

    card.appendChild(v);
    card.appendChild(l);
    return card;
  }
}
