import type { NotebookCell, MarkdownCell, QueryResultCell, SnapshotCell } from '../types.js';
import type { NotebookStore } from '../notebook/notebookStore.js';
import { el } from './domUtils.js';
import { marked } from 'marked';

export class Notebook {
  private container: HTMLElement;
  private store: NotebookStore;
  private cellListEl!: HTMLElement;
  private snapshotClickListeners: Array<(cell: SnapshotCell) => void> = [];

  constructor(container: HTMLElement, store: NotebookStore) {
    this.container = container;
    this.store = store;
    this.render();
    this.store.onChange(() => this.renderCells());
  }

  onSnapshotClick(listener: (cell: SnapshotCell) => void): void {
    this.snapshotClickListeners.push(listener);
  }

  // ── Initial render ────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'notebook-root';

    this.cellListEl = el('div', { class: 'notebook-cell-list' });
    this.container.appendChild(this.cellListEl);

    const footer = el('div', { class: 'notebook-footer' });
    const addNoteBtn = el('button', { class: 'notebook-add-btn' }, '+ Note');
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
      const empty = el('div', { class: 'notebook-empty' }, 'まだセルがありません。グラフからスナップショットを送るか、「+ Note」でメモを追加してください。');
      this.cellListEl.appendChild(empty);
      return;
    }
    for (const cell of cells) {
      this.cellListEl.appendChild(this.renderCell(cell));
    }
  }

  private renderCell(cell: NotebookCell): HTMLElement {
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
      wrap.appendChild(this.buildTable(cell.rows));
    }

    return wrap;
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

    const img = el('img', { class: 'nb-snapshot-img', src: cell.pngDataUrl, alt: cell.label }) as HTMLImageElement;
    const hint = el('div', { class: 'nb-snapshot-hint' }, 'クリックで Graph タブに切り替え');
    const imgWrap = el('div', { class: 'nb-snapshot-img-wrap' });
    imgWrap.appendChild(img);
    imgWrap.appendChild(hint);
    imgWrap.addEventListener('click', () => {
      for (const listener of this.snapshotClickListeners) {
        listener(cell);
      }
    });
    wrap.appendChild(imgWrap);

    return wrap;
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
