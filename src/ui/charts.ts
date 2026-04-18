// ── Shared chart utilities ────────────────────────────────────────────────────
// Used by both Dashboard and Scrapbook.

// ── Horizontal bar chart (Dashboard style) ────────────────────────────────────

export interface HBarChartData {
  label: string;
  value: number;
  color: string;
}

export const CHART_PALETTE: readonly string[] = [
  '#6c8ef7',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#38bdf8',
  '#fb923c',
  '#e879f9',
  '#4ade80',
  '#f472b6',
];

export function pickColor(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length] ?? '#6c8ef7';
}

export function buildHBarChart(data: HBarChartData[], title: string): SVGSVGElement {
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
    text.textContent = d.label.length > 16 ? `${d.label.slice(0, 15)}…` : d.label;
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

// ── Time-series / vertical charts (Scrapbook style) ───────────────────────────

function makeSvg(w: number, h: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(h));
  svg.style.display = 'block';
  return svg;
}

function formatAxisValue(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

interface ChartBase {
  W: number;
  H: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  values: number[];
  maxVal: number;
  minVal: number;
  range: number;
  svg: SVGSVGElement;
  innerW: number;
  innerH: number;
}

function buildChartBase(rows: Record<string, unknown>[], key: string): ChartBase {
  const W = 600,
    H = 200,
    padL = 48,
    padR = 16,
    padT = 16,
    padB = 40;
  const values = rows.map((r) => (typeof r[key] === 'number' ? (r[key] as number) : 0));
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;
  const svg = makeSvg(W, H);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  return {
    W,
    H,
    padL,
    padR,
    padT,
    padB,
    values,
    maxVal,
    minVal,
    range,
    svg,
    innerW,
    innerH,
  };
}

function drawGridLines(
  svg: SVGSVGElement,
  W: number,
  H: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number,
  minVal: number,
  maxVal: number,
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
    text.textContent = formatAxisValue(val);
    svg.appendChild(text);
  }
}

function drawXLabels(
  svg: SVGSVGElement,
  rows: Record<string, unknown>[],
  W: number,
  H: number,
  padL: number,
  padR: number,
  padB: number,
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
    text.textContent = label.length > 8 ? `${label.slice(0, 7)}…` : label;
    svg.appendChild(text);
  });
}

export function buildBarChart(rows: Record<string, unknown>[], key: string): SVGSVGElement {
  const { W, H, padL, padR, padT, padB, values, maxVal, minVal, range, svg, innerW, innerH } =
    buildChartBase(rows, key);
  const barW = Math.max(2, innerW / rows.length - 2);
  const zeroY = padT + innerH * (1 - (0 - minVal) / range);

  drawGridLines(svg, W, H, padL, padR, padT, padB, minVal, maxVal);

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

  drawXLabels(svg, rows, W, H, padL, padR, padB);
  return svg;
}

export function buildLineChart(rows: Record<string, unknown>[], key: string): SVGSVGElement {
  const { W, H, padL, padR, padT, padB, values, maxVal, minVal, range, svg, innerW, innerH } =
    buildChartBase(rows, key);

  drawGridLines(svg, W, H, padL, padR, padT, padB, minVal, maxVal);

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

  drawXLabels(svg, rows, W, H, padL, padR, padB);
  return svg;
}
