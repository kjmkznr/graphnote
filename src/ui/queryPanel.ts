import { escHtml, byId } from './domUtils.js';

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return `<span class="val-null">null</span>`;
  if (typeof v === 'boolean') return `<span class="val-bool">${v}</span>`;
  if (typeof v === 'number') return `<span class="val-number">${v}</span>`;
  if (typeof v === 'string') return `<span class="val-string">"${escHtml(v)}"</span>`;
  if (typeof v === 'object') return `<span class="val-object">${escHtml(JSON.stringify(v, null, 2))}</span>`;
  return escHtml(String(v));
}

export class QueryPanel {
  private elInput = byId<HTMLTextAreaElement>('query-input');
  private elRunBtn = byId<HTMLButtonElement>('run-btn');
  private elResults = byId('query-results');

  private onExecuteCb: ((query: string) => void) | null = null;

  constructor() {
    this.elRunBtn.addEventListener('click', () => this.run());
    this.elInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.run();
      }
    });
  }

  private run(): void {
    const query = this.elInput.value.trim();
    if (!query || !this.onExecuteCb) return;
    this.onExecuteCb(query);
  }

  onExecute(cb: (query: string) => void): void {
    this.onExecuteCb = cb;
  }

  showResult(rows: unknown[], elapsedMs: number): void {
    if (rows.length === 0) {
      this.elResults.innerHTML = `
        <span class="result-tag tag-empty">No rows</span>
        <div style="color:var(--text-muted);font-size:12px;margin-top:4px">クエリは成功しました（結果なし） ${elapsedMs.toFixed(1)} ms</div>
      `;
      return;
    }

    const cols = Object.keys(rows[0] as object);
    const thead = `<tr>${cols.map((c) => `<th>${escHtml(c)}</th>`).join('')}</tr>`;
    const tbody = (rows as Record<string, unknown>[]).map((row) =>
      `<tr>${cols.map((col) => `<td>${renderValue(row[col])}</td>`).join('')}</tr>`,
    ).join('');

    this.elResults.innerHTML = `
      <span class="result-tag tag-ok">${rows.length} row${rows.length !== 1 ? 's' : ''}</span>
      <span style="color:var(--text-muted);font-size:11px;margin-left:8px">${elapsedMs.toFixed(1)} ms</span>
      <div style="overflow-x:auto;margin-top:8px">
        <table class="result-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
      </div>
    `;
  }

  showError(message: string): void {
    this.elResults.innerHTML = `
      <span class="result-tag tag-err">Error</span>
      <div class="error-box" style="margin-top:6px">${escHtml(message)}</div>
    `;
  }

  setQuery(query: string): void {
    this.elInput.value = query;
    this.elInput.focus();
  }
}
