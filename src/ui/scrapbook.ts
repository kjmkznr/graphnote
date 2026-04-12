import cytoscape from 'cytoscape';
import type { ScrapbookCell, MarkdownCell, QueryResultCell, SnapshotCell, RawNode, RawEdge } from '../types.js';
import type { ScrapbookStore } from '../notebook/scrapbookStore.js';
import { el } from './domUtils.js';
import { isEdgeValue } from '../utils/graphUtils.js';
import { marked } from 'marked';
import { CYTOSCAPE_STYLES } from './cytoscapeStyles.js';

export class Scrapbook {
  private container: HTMLElement;
  private store: ScrapbookStore;
  private cellListEl!: HTMLElement;
  constructor(container: HTMLElement, store: ScrapbookStore) {
    this.container = container;
    this.store = store;
    this.render();
    this.store.onChange(() => this.renderCells());
  }

  // ── Initial render ────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'scrapbook-root';

    this.cellListEl = el('div', { class: 'scrapbook-cell-list' });
    this.container.appendChild(this.cellListEl);

    const footer = el('div', { class: 'scrapbook-footer' });
    const addNoteBtn = el('button', { class: 'scrapbook-add-btn' }, '+ Note');
    addNoteBtn.addEventListener('click', () => this.addMarkdownCell());
    footer.appendChild(addNoteBtn);
    this.container.appendChild(footer);

    this.renderCells();
  }

  // ── Cell list rendering ───────────────────────────────────────────────────────

  private renderCells(): void {
    this.cellListEl.innerHTML = '';
    const cells = this.store.getCells();
    if (cells.length === 0) {
      const empty = el('div', { class: 'scrapbook-empty' }, 'まだセルがありません。グラフからスナップショットを送るか、「+ Note」でメモを追加してください。');
      this.cellListEl.appendChild(empty);
      return;
    }
    for (const cell of cells) {
      this.cellListEl.appendChild(this.renderCell(cell));
    }
  }

  private renderCell(cell: ScrapbookCell): HTMLElement {
    switch (cell.kind) {
      case 'markdown':      return this.renderMarkdownCell(cell);
      case 'query-result':  return this.renderQueryResultCell(cell);
      case 'snapshot':      return this.renderSnapshotCell(cell);
    }
  }

  // ── Markdown cell ─────────────────────────────────────────────────────────────

  private renderMarkdownCell(cell: MarkdownCell): HTMLElement {
    const wrap = el('div', { class: 'nb-cell nb-cell-markdown', 'data-id': cell.id });

    const header = this.makeCellHeader('Note', cell.id);
    wrap.appendChild(header);

    const preview = el('div', { class: 'nb-markdown-preview' });
    const textarea = el('textarea', { class: 'nb-markdown-input', placeholder: 'Markdown でメモを書く…' }) as HTMLTextAreaElement;
    textarea.value = cell.content;

    const updatePreview = (): void => {
      preview.innerHTML = marked.parse(textarea.value) as string;
    };
    updatePreview();

    const showPreview = (): void => {
      textarea.classList.add('nb-hidden');
      preview.classList.remove('nb-hidden');
    };
    const showEditor = (): void => {
      preview.classList.add('nb-hidden');
      textarea.classList.remove('nb-hidden');
      textarea.focus();
    };

    // 初期状態: コンテンツがあればプレビュー、なければエディタ
    if (cell.content) {
      showPreview();
    } else {
      preview.classList.add('nb-hidden');
    }

    textarea.addEventListener('input', () => {
      this.store.updateCell(cell.id, { content: textarea.value }, true);
      updatePreview();
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.metaKey) {
        e.preventDefault();
        if (textarea.value) {
          showPreview();
        }
      }
    });
    textarea.addEventListener('blur', () => {
      if (textarea.value) {
        showPreview();
      }
    });
    preview.addEventListener('click', () => {
      showEditor();
    });

    wrap.appendChild(textarea);
    wrap.appendChild(preview);

    return wrap;
  }

  // ── Query result cell ─────────────────────────────────────────────────────────

  private renderQueryResultCell(cell: QueryResultCell): HTMLElement {
    const wrap = el('div', { class: 'nb-cell nb-cell-query', 'data-id': cell.id });

    const header = this.makeCellHeader('Query Result', cell.id);
    wrap.appendChild(header);

    const queryEl = el('pre', { class: 'nb-query-text' }, cell.query);
    wrap.appendChild(queryEl);

    const meta = el('div', { class: 'nb-query-meta' }, `${cell.rows.length} rows · ${cell.elapsedMs.toFixed(1)} ms`);
    wrap.appendChild(meta);

    if (cell.rows.length > 0) {
      const { nodes, edges } = this.extractGraphElements(cell.rows);
      if (nodes.length > 0) {
        wrap.appendChild(this.buildGraphSection(nodes, edges));
      }
      const flatRows = this.flattenRows(cell.rows);
      const numericKeys = this.getNumericKeys(flatRows);
      if (numericKeys.length > 0) {
        wrap.appendChild(this.buildChartSection(flatRows, numericKeys));
      }
      wrap.appendChild(this.buildTable(flatRows));
    }

    return wrap;
  }

  private extractGraphElements(rows: Record<string, unknown>[]): { nodes: RawNode[]; edges: RawEdge[] } {
    const nodeMap = new Map<string, RawNode>();
    const edgeMap = new Map<string, RawEdge>();
    for (const row of rows) {
      for (const val of Object.values(row)) {
        if (val === null || typeof val !== 'object' || Array.isArray(val)) continue;
        const obj = val as Record<string, unknown>;
        if (
          typeof obj['_id'] === 'string' &&
          Array.isArray(obj['_labels']) &&
          typeof obj['_properties'] === 'object' && obj['_properties'] !== null
        ) {
          const node = obj as unknown as RawNode;
          nodeMap.set(node._id, node);
        } else if (
          typeof obj['_id'] === 'string' &&
          typeof obj['_type'] === 'string' &&
          typeof obj['_src'] === 'string' &&
          typeof obj['_dst'] === 'string'
        ) {
          const edge = obj as unknown as RawEdge;
          edgeMap.set(edge._id, edge);
        }
      }
    }
    const nodes = Array.from(nodeMap.values());
    const edges = Array.from(edgeMap.values());
    return { nodes, edges };
  }

  private buildGraphSection(nodes: RawNode[], edges: RawEdge[]): HTMLElement {
    const section = el('div', { class: 'nb-graph-section' });
    const container = el('div', { class: 'nb-graph-container' });
    section.appendChild(container);

    // Cytoscapeは要素がDOMに追加された後に初期化する必要があるためrequestAnimationFrameを使用
    requestAnimationFrame(() => {
      const PALETTE = [
        '#6c8ef7', '#a78bfa', '#34d399', '#f87171',
        '#fbbf24', '#38bdf8', '#fb923c', '#e879f9',
      ];
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

  private isEdgeOnlyRow(row: Record<string, unknown>): boolean {
    const values = Object.values(row);
    if (values.length === 0) return false;
    return values.every(isEdgeValue);
  }

  private flattenRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows
      .filter(row => !this.isEdgeOnlyRow(row))
      .map(row => {
        const flat: Record<string, unknown> = {};
        for (const [colKey, val] of Object.entries(row)) {
          if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            const obj = val as Record<string, unknown>;
            // ノード/エッジオブジェクト（_propertiesを持つ）はプロパティを展開
            if (typeof obj['_properties'] === 'object' && obj['_properties'] !== null) {
              const props = obj['_properties'] as Record<string, unknown>;
              for (const [pk, pv] of Object.entries(props)) {
                flat[`${colKey}.${pk}`] = pv;
              }
            } else {
              flat[colKey] = val;
            }
          } else {
            flat[colKey] = val;
          }
        }
        return flat;
      });
  }

  private getNumericKeys(rows: Record<string, unknown>[]): string[] {
    const first = rows[0] ?? {};
    return Object.keys(first).filter(k => {
      return rows.every(r => r[k] === null || typeof r[k] === 'number');
    });
  }

  private buildChartSection(rows: Record<string, unknown>[], numericKeys: string[]): HTMLElement {
    const section = el('div', { class: 'nb-chart-section' });

    // チャートタイプ選択タブ
    const tabs = el('div', { class: 'nb-chart-tabs' });
    const chartArea = el('div', { class: 'nb-chart-area' });

    const chartTypes: Array<{ id: string; label: string }> = [
      { id: 'bar', label: 'Bar' },
      { id: 'line', label: 'Line' },
    ];

    let activeChart = 'bar';
    let activeKey = numericKeys[0] ?? '';

    // 系列選択
    const seriesWrap = el('div', { class: 'nb-chart-series' });
    for (const k of numericKeys) {
      const btn = el('button', { class: `nb-chart-series-btn${k === activeKey ? ' active' : ''}`, 'data-key': k }, k);
      btn.addEventListener('click', () => {
        activeKey = k;
        seriesWrap.querySelectorAll('.nb-chart-series-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderChart();
      });
      seriesWrap.appendChild(btn);
    }

    const renderChart = (): void => {
      chartArea.innerHTML = '';
      if (activeChart === 'bar' && activeKey) {
        chartArea.appendChild(this.buildBarChart(rows, activeKey));
      } else if (activeKey) {
        chartArea.appendChild(this.buildLineChart(rows, activeKey));
      }
    };

    for (const ct of chartTypes) {
      const btn = el('button', { class: `nb-chart-tab-btn${ct.id === activeChart ? ' active' : ''}` }, ct.label);
      btn.addEventListener('click', () => {
        activeChart = ct.id;
        tabs.querySelectorAll('.nb-chart-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderChart();
      });
      tabs.appendChild(btn);
    }

    const controls = el('div', { class: 'nb-chart-controls' });
    controls.appendChild(tabs);
    if (numericKeys.length > 1) controls.appendChild(seriesWrap);
    section.appendChild(controls);
    section.appendChild(chartArea);

    renderChart();
    return section;
  }

  private buildChartBase(rows: Record<string, unknown>[], key: string): {
    W: number; H: number; padL: number; padR: number; padT: number; padB: number;
    values: number[]; maxVal: number; minVal: number; range: number;
    svg: SVGSVGElement; innerW: number; innerH: number;
  } {
    const W = 600, H = 200, padL = 48, padR = 16, padT = 16, padB = 40;
    const values = rows.map(r => (typeof r[key] === 'number' ? (r[key] as number) : 0));
    const maxVal = Math.max(...values, 0);
    const minVal = Math.min(...values, 0);
    const range = maxVal - minVal || 1;
    const svg = this.makeSvg(W, H);
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    return { W, H, padL, padR, padT, padB, values, maxVal, minVal, range, svg, innerW, innerH };
  }

  private buildBarChart(rows: Record<string, unknown>[], key: string): SVGSVGElement {
    const { W, H, padL, padR, padT, padB, values, maxVal, minVal, range, svg, innerW, innerH } = this.buildChartBase(rows, key);
    const barW = Math.max(2, innerW / rows.length - 2);
    const zeroY = padT + innerH * (1 - (0 - minVal) / range);

    this.drawGridLines(svg, W, H, padL, padR, padT, padB, minVal, maxVal);

    values.forEach((v, i) => {
      const x = padL + (i + 0.5) * (innerW / rows.length) - barW / 2;
      const y = padT + innerH * (1 - (v - minVal) / range);
      const barH = Math.abs(zeroY - y);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(Math.min(y, zeroY)));
      rect.setAttribute('width', String(barW));
      rect.setAttribute('height', String(Math.max(barH, 1)));
      rect.setAttribute('fill', 'var(--accent)');
      rect.setAttribute('opacity', '0.8');
      rect.setAttribute('rx', '2');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${v}`;
      rect.appendChild(title);
      svg.appendChild(rect);
    });

    this.drawXLabels(svg, rows, W, H, padL, padR, padB);
    return svg;
  }

  private buildLineChart(rows: Record<string, unknown>[], key: string): SVGSVGElement {
    const { W, H, padL, padR, padT, padB, values, maxVal, minVal, range, svg, innerW, innerH } = this.buildChartBase(rows, key);

    this.drawGridLines(svg, W, H, padL, padR, padT, padB, minVal, maxVal);

    const points = values.map((v, i) => {
      const x = padL + (i + 0.5) * (innerW / rows.length);
      const y = padT + innerH * (1 - (v - minVal) / range);
      return `${x},${y}`;
    });

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points.join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', 'var(--accent)');
    polyline.setAttribute('stroke-width', '2');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    values.forEach((v, i) => {
      const [px, py] = (points[i] ?? '0,0').split(',').map(Number);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(px));
      circle.setAttribute('cy', String(py));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', 'var(--accent)');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${v}`;
      circle.appendChild(title);
      svg.appendChild(circle);
    });

    this.drawXLabels(svg, rows, W, H, padL, padR, padB);
    return svg;
  }

  private makeSvg(w: number, h: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(h));
    svg.style.display = 'block';
    return svg;
  }

  private drawGridLines(
    svg: SVGSVGElement,
    W: number, H: number,
    padL: number, padR: number, padT: number, padB: number,
    minVal: number, maxVal: number
  ): void {
    const innerH = H - padT - padB;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padT + (innerH / steps) * i;
      const val = maxVal - ((maxVal - minVal) / steps) * i;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(padL));
      line.setAttribute('x2', String(W - padR));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(padL - 4));
      text.setAttribute('y', String(y + 4));
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', 'var(--text-muted)');
      text.textContent = this.formatAxisValue(val);
      svg.appendChild(text);
    }
  }

  private drawXLabels(
    svg: SVGSVGElement,
    rows: Record<string, unknown>[],
    W: number, H: number,
    padL: number, padR: number, padB: number
  ): void {
    const innerW = W - padL - padR;
    const maxLabels = 10;
    const step = Math.ceil(rows.length / maxLabels);
    rows.forEach((row, i) => {
      if (i % step !== 0 && i !== rows.length - 1) return;
      const x = padL + (i + 0.5) * (innerW / rows.length);
      const firstKey = Object.keys(row)[0];
      const label = firstKey ? String(row[firstKey] ?? i) : String(i);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(H - padB + 14));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', 'var(--text-muted)');
      text.textContent = label.length > 8 ? label.slice(0, 7) + '…' : label;
      svg.appendChild(text);
    });
  }

  private formatAxisValue(val: number): string {
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  }

  private buildTable(rows: Record<string, unknown>[]): HTMLElement {
    const first = rows[0] ?? {};
    const keys = Object.keys(first);
    const table = el('table', { class: 'result-table nb-result-table' });
    const thead = el('thead');
    const headerRow = el('tr');
    for (const k of keys) {
      headerRow.appendChild(el('th', {}, k));
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const row of rows) {
      const tr = el('tr');
      for (const k of keys) {
        const val = row[k];
        const td = el('td', {}, this.formatValue(val));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  private formatValue(val: unknown): string {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  // ── Snapshot cell ─────────────────────────────────────────────────────────────

  private renderSnapshotCell(cell: SnapshotCell): HTMLElement {
    const wrap = el('div', { class: 'nb-cell nb-cell-snapshot', 'data-id': cell.id });

    const header = this.makeCellHeader('Snapshot', cell.id);
    wrap.appendChild(header);

    const label = el('div', { class: 'nb-snapshot-label' }, cell.label);
    wrap.appendChild(label);

    const img = el('img', { class: 'nb-snapshot-thumbnail', src: cell.pngDataUrl, alt: cell.label }) as HTMLImageElement;
    const imgWrap = el('div', { class: 'nb-snapshot-img-wrap' });
    imgWrap.appendChild(img);
    imgWrap.addEventListener('click', () => {
      this.openSnapshotModal(cell);
    });
    wrap.appendChild(imgWrap);

    return wrap;
  }

  private openSnapshotModal(cell: SnapshotCell): void {
    const overlay = el('div', { class: 'nb-snapshot-modal-overlay' });
    const modalImg = el('img', { class: 'nb-snapshot-modal-img', src: cell.pngDataUrl, alt: cell.label }) as HTMLImageElement;
    overlay.appendChild(modalImg);
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private makeCellHeader(kindLabel: string, cellId: string): HTMLElement {
    const header = el('div', { class: 'nb-cell-header' });
    const badge = el('span', { class: `nb-cell-badge nb-badge-${kindLabel.toLowerCase().replace(' ', '-')}` }, kindLabel);
    header.appendChild(badge);

    const deleteBtn = el('button', { class: 'nb-cell-delete-btn', title: 'セルを削除' }, '✕');
    deleteBtn.addEventListener('click', () => {
      this.store.deleteCell(cellId);
    });
    header.appendChild(deleteBtn);
    return header;
  }

  private addMarkdownCell(): void {
    const cell: MarkdownCell = {
      id: crypto.randomUUID(),
      kind: 'markdown',
      createdAt: Date.now(),
      content: '',
    };
    this.store.addCell(cell);
    // 追加後に末尾へスクロール
    requestAnimationFrame(() => {
      this.cellListEl.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
