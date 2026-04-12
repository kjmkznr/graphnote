import type { QueryResultCell, RawNode, RawEdge } from '../../types.js';
import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';
import { el } from '../domUtils.js';
import { buildBarChart, buildLineChart } from '../charts.js';
import { isEdgeValue } from '../../utils/graphUtils.js';
import { buildMiniGraph } from '../scrapbookMiniGraph.js';
import { makeCellHeader, attachMemoButton, makeMemoSection } from './cellHelpers.js';

export function renderQueryResultCell(cell: QueryResultCell, store: ScrapbookStore): HTMLElement {
  const wrap = el('div', { class: 'nb-cell nb-cell-query', 'data-id': cell.id });

  const header = makeCellHeader('Query Result', cell.id, store);
  attachMemoButton(header);
  wrap.appendChild(header);

  const memoWrap = makeMemoSection(cell.id, cell.memo, store);
  wrap.appendChild(memoWrap);

  const queryEl = el('pre', { class: 'nb-query-text' }, cell.query);
  wrap.appendChild(queryEl);

  const meta = el('div', { class: 'nb-query-meta' }, `${cell.rows.length} rows · ${cell.elapsedMs.toFixed(1)} ms`);
  wrap.appendChild(meta);

  if (cell.rows.length > 0) {
    const { nodes, edges } = extractGraphElements(cell.rows);
    if (nodes.length > 0) {
      wrap.appendChild(buildMiniGraph(nodes, edges));
    }
    const flatRows = flattenRows(cell.rows);
    const numericKeys = getNumericKeys(flatRows);
    if (numericKeys.length > 0) {
      wrap.appendChild(buildChartSection(flatRows, numericKeys));
    }
    wrap.appendChild(buildTable(flatRows));
  }

  return wrap;
}

function extractGraphElements(rows: Record<string, unknown>[]): { nodes: RawNode[]; edges: RawEdge[] } {
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

function isEdgeOnlyRow(row: Record<string, unknown>): boolean {
  const values = Object.values(row);
  if (values.length === 0) return false;
  return values.every(isEdgeValue);
}

function flattenRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows
    .filter(row => !isEdgeOnlyRow(row))
    .map(row => {
      const flat: Record<string, unknown> = {};
      for (const [colKey, val] of Object.entries(row)) {
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          const obj = val as Record<string, unknown>;
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

function getNumericKeys(rows: Record<string, unknown>[]): string[] {
  const first = rows[0] ?? {};
  return Object.keys(first).filter(k => {
    return rows.every(r => r[k] === null || typeof r[k] === 'number');
  });
}

export function buildChartSection(rows: Record<string, unknown>[], numericKeys: string[]): HTMLElement {
  const section = el('div', { class: 'nb-chart-section' });

  const tabs = el('div', { class: 'nb-chart-tabs' });
  const chartArea = el('div', { class: 'nb-chart-area' });

  const chartTypes: Array<{ id: string; label: string }> = [
    { id: 'bar', label: 'Bar' },
    { id: 'line', label: 'Line' },
  ];

  let activeChart = 'bar';
  let activeKey = numericKeys[0] ?? '';

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
      chartArea.appendChild(buildBarChart(rows, activeKey));
    } else if (activeKey) {
      chartArea.appendChild(buildLineChart(rows, activeKey));
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

export function buildTable(rows: Record<string, unknown>[]): HTMLElement {
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
      const td = el('td', {}, formatValue(val));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
