import type { RawNode, RawEdge } from '../types.js';

interface BarChartData {
  label: string;
  value: number;
  color: string;
}

const PALETTE: readonly string[] = [
  '#6c8ef7', '#a78bfa', '#34d399', '#fbbf24', '#f87171',
  '#38bdf8', '#fb923c', '#e879f9', '#4ade80', '#f472b6',
];

function pickColor(i: number): string {
  return PALETTE[i % PALETTE.length] ?? '#6c8ef7';
}

function buildBarChart(data: BarChartData[], title: string): SVGSVGElement {
  const BAR_H = 24;
  const GAP = 6;
  const LABEL_W = 140;
  const VALUE_W = 40;
  const MAX_BAR_W = 260;
  const PADDING = 16;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const height = PADDING + data.length * (BAR_H + GAP) + PADDING;
  const width = LABEL_W + MAX_BAR_W + VALUE_W + PADDING * 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);

  data.forEach((d, i) => {
    const y = PADDING + i * (BAR_H + GAP);
    const barW = Math.max(2, (d.value / maxVal) * MAX_BAR_W);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(LABEL_W - 8));
    text.setAttribute('y', String(y + BAR_H / 2 + 4));
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-family', 'JetBrains Mono, Fira Code, ui-monospace, monospace');
    text.setAttribute('fill', '#8892a4');
    text.textContent = d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label;
    svg.appendChild(text);

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', String(LABEL_W));
    bgRect.setAttribute('y', String(y));
    bgRect.setAttribute('width', String(MAX_BAR_W));
    bgRect.setAttribute('height', String(BAR_H));
    bgRect.setAttribute('rx', '4');
    bgRect.setAttribute('fill', 'rgba(46,50,71,0.6)');
    svg.appendChild(bgRect);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(LABEL_W));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(BAR_H));
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', d.color);
    rect.setAttribute('opacity', '0.85');
    svg.appendChild(rect);

    const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valText.setAttribute('x', String(LABEL_W + MAX_BAR_W + 8));
    valText.setAttribute('y', String(y + BAR_H / 2 + 4));
    valText.setAttribute('font-size', '12');
    valText.setAttribute('font-family', 'JetBrains Mono, Fira Code, ui-monospace, monospace');
    valText.setAttribute('fill', '#e2e8f0');
    valText.setAttribute('font-weight', '600');
    valText.textContent = String(d.value);
    svg.appendChild(valText);
  });

  return svg;
}

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

    // ── Node type distribution ─────────────────────────────────────────────────
    const nodeTypeCounts = new Map<string, number>();
    for (const node of nodes) {
      for (const label of node._labels) {
        nodeTypeCounts.set(label, (nodeTypeCounts.get(label) ?? 0) + 1);
      }
    }
    const nodeTypeData: BarChartData[] = [...nodeTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: pickColor(i) }));

    grid.appendChild(buildSection(
      'ノードタイプ別分布',
      nodeTypeData.length > 0
        ? buildBarChart(nodeTypeData, 'ノードタイプ別分布')
        : buildEmptyMessage('ノードがありません'),
    ));

    // ── Edge type distribution ─────────────────────────────────────────────────
    const edgeTypeCounts = new Map<string, number>();
    for (const edge of edges) {
      edgeTypeCounts.set(edge._type, (edgeTypeCounts.get(edge._type) ?? 0) + 1);
    }
    const edgeTypeData: BarChartData[] = [...edgeTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: pickColor(i) }));

    grid.appendChild(buildSection(
      'エッジタイプ別分布',
      edgeTypeData.length > 0
        ? buildBarChart(edgeTypeData, 'エッジタイプ別分布')
        : buildEmptyMessage('エッジがありません'),
    ));

    // ── Degree distribution ────────────────────────────────────────────────────
    const internalIdToGnId = new Map<string, string>();
    for (const node of nodes) {
      const gnId = node._properties['gnId'];
      if (typeof gnId === 'string') internalIdToGnId.set(node._id, gnId);
    }

    const gnIdDegree = new Map<string, number>();
    for (const node of nodes) {
      const gnId = node._properties['gnId'];
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
    const degreeData: BarChartData[] = [...degreeBuckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([deg, count], i) => ({ label: `接続数 ${deg}`, value: count, color: pickColor(i) }));

    grid.appendChild(buildSection(
      '接続数分布（ノード数）',
      degreeData.length > 0
        ? buildBarChart(degreeData, '接続数分布')
        : buildEmptyMessage('ノードがありません'),
    ));

    // ── Top connected nodes ────────────────────────────────────────────────────
    const topNodes: BarChartData[] = [...gnIdDegree.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .filter(([, deg]) => deg > 0)
      .map(([gnId, deg], i) => {
        const node = nodes.find((n) => n._properties['gnId'] === gnId);
        const name = node
          ? String(node._properties['name'] ?? node._labels[0] ?? gnId)
          : gnId;
        return { label: name, value: deg, color: pickColor(i) };
      });

    grid.appendChild(buildSection(
      '接続数 Top 10 ノード',
      topNodes.length > 0
        ? buildBarChart(topNodes, '接続数 Top 10 ノード')
        : buildEmptyMessage('エッジがありません'),
    ));

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
