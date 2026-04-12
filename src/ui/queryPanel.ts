import { escHtml, byId } from './domUtils.js';
import { getCompletions, applyCompletion } from './cypherAutocomplete.js';
import type { CompletionContext, CompletionItem } from './cypherAutocomplete.js';

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return `<span class="val-null">null</span>`;
  if (typeof v === 'boolean') return `<span class="val-bool">${v}</span>`;
  if (typeof v === 'number') return `<span class="val-number">${v}</span>`;
  if (typeof v === 'string') return `<span class="val-string">"${escHtml(v)}"</span>`;
  if (typeof v === 'object') return `<span class="val-object">${escHtml(JSON.stringify(v, null, 2))}</span>`;
  return escHtml(String(v));
}

const KIND_ICON: Record<CompletionItem['kind'], string> = {
  keyword: 'KW',
  nodeType: 'N',
  edgeType: 'E',
  property: 'P',
};

export class QueryPanel {
  private elInput = byId<HTMLTextAreaElement>('query-input');
  private elRunBtn = byId<HTMLButtonElement>('run-btn');
  private elResults = byId('query-results');
  private onExecuteCb: ((query: string) => void) | null = null;

  private completionContext: CompletionContext = {
    nodeTypes: [],
    edgeTypes: [],
    propertyKeys: [],
  };

  private dropdown: HTMLElement;
  private items: CompletionItem[] = [];
  private activeIndex = -1;

  constructor() {
    this.dropdown = this.createDropdown();
    this.elRunBtn.addEventListener('click', () => this.run());
    this.elInput.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.elInput.addEventListener('input', () => this.handleInput());
    this.elInput.addEventListener('blur', () => {
      // 少し遅延してからdropdownを閉じる（クリック選択を先に処理するため）
      setTimeout(() => this.hideDropdown(), 150);
    });
  }

  private createDropdown(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'cypher-autocomplete-dropdown';
    el.className = 'autocomplete-dropdown';
    el.style.display = 'none';
    el.style.position = 'fixed';
    document.body.appendChild(el);
    return el;
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab' && this.items.length > 0) {
      e.preventDefault();
      const idx = this.activeIndex >= 0 ? this.activeIndex : 0;
      this.selectItem(idx);
      return;
    }
    if (this.dropdown.style.display !== 'none') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.setActiveIndex(Math.min(this.activeIndex + 1, this.items.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.setActiveIndex(Math.max(this.activeIndex - 1, 0));
        return;
      }
      if (e.key === 'Enter' && this.activeIndex >= 0) {
        e.preventDefault();
        this.selectItem(this.activeIndex);
        return;
      }
      if (e.key === 'Escape') {
        this.hideDropdown();
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.run();
    }
  }

  private handleInput(): void {
    const cursorPos = this.elInput.selectionStart ?? this.elInput.value.length;
    const text = this.elInput.value;
    const candidates = getCompletions(text, cursorPos, this.completionContext);
    if (candidates.length === 0) {
      this.hideDropdown();
      return;
    }
    this.showDropdown(candidates, cursorPos);
  }

  private showDropdown(candidates: CompletionItem[], cursorPos: number): void {
    this.items = candidates;
    this.activeIndex = -1;
    this.dropdown.innerHTML = '';

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i]!;
      const row = document.createElement('div');
      row.className = 'autocomplete-item';
      row.dataset['index'] = String(i);
      row.innerHTML = `<span class="autocomplete-kind autocomplete-kind-${item.kind}">${KIND_ICON[item.kind]}</span><span class="autocomplete-label">${escHtml(item.label)}</span>`;
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.selectItem(i);
      });
      this.dropdown.appendChild(row);
    }

    // カーソル位置付近にドロップダウンを表示（fixed座標で配置）
    const coords = this.getCaretCoordinates(cursorPos);
    const taRect = this.elInput.getBoundingClientRect();
    this.dropdown.style.left = `${taRect.left + coords.left}px`;
    this.dropdown.style.top = `${taRect.top + coords.top + 18}px`;
    this.dropdown.style.display = 'block';
  }

  private hideDropdown(): void {
    this.dropdown.style.display = 'none';
    this.items = [];
    this.activeIndex = -1;
  }

  private setActiveIndex(idx: number): void {
    const rows = this.dropdown.querySelectorAll<HTMLElement>('.autocomplete-item');
    const prevRow = this.activeIndex >= 0 ? rows[this.activeIndex] : undefined;
    if (prevRow) prevRow.classList.remove('active');
    this.activeIndex = idx;
    const nextRow = rows[idx];
    if (nextRow) {
      nextRow.classList.add('active');
      nextRow.scrollIntoView({ block: 'nearest' });
    }
  }

  private selectItem(idx: number): void {
    const item = this.items[idx];
    if (!item) return;
    const cursorPos = this.elInput.selectionStart ?? this.elInput.value.length;
    const { newText, newCursorPos } = applyCompletion(
      this.elInput.value,
      cursorPos,
      item.label,
    );
    this.elInput.value = newText;
    this.elInput.setSelectionRange(newCursorPos, newCursorPos);
    this.hideDropdown();
    this.elInput.focus();
  }

  /**
   * textarea 内のカーソル位置の座標を計算する。
   * textarea の相対座標で返す。
   */
  private getCaretCoordinates(cursorPos: number): { left: number; top: number } {
    const ta = this.elInput;
    const taRect = ta.getBoundingClientRect();
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(ta);
    const props = [
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
      'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingRight',
      'borderTopWidth', 'borderLeftWidth',
    ] as const;
    for (const prop of props) {
      (mirror.style as unknown as Record<string, string>)[prop] = style.getPropertyValue(
        prop.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`),
      );
    }
    mirror.style.width = `${ta.clientWidth}px`;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-word';
    // viewport座標で配置してspanのviewport座標を直接取得する
    mirror.style.position = 'fixed';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';
    mirror.style.top = `${taRect.top}px`;
    mirror.style.left = `${taRect.left}px`;

    const before = escHtml(ta.value.slice(0, cursorPos)).replace(/\n$/, '\n\u200b');
    mirror.innerHTML = `${before}<span id="caret-mirror"></span>`;
    document.body.appendChild(mirror);
    const span = mirror.querySelector<HTMLSpanElement>('#caret-mirror');
    let left = 0;
    let top = 0;
    if (span) {
      const spanRect = span.getBoundingClientRect();
      // spanのviewport座標からtextareaのviewport座標を引いてtextarea相対座標を得る
      left = spanRect.left - taRect.left;
      top = spanRect.top - taRect.top;
    }
    document.body.removeChild(mirror);
    return { left, top };
  }

  private run(): void {
    const query = this.elInput.value.trim();
    if (!query || !this.onExecuteCb) return;
    this.onExecuteCb(query);
  }

  onExecute(cb: (query: string) => void): void {
    this.onExecuteCb = cb;
  }

  setCompletionContext(context: CompletionContext): void {
    this.completionContext = context;
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
