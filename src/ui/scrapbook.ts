import type { ScrapbookStore } from '../notebook/scrapbookStore.js';
import type { MarkdownCell, ScrapbookCell, SectionCell } from '../types.js';
import { clearChildren, el } from './domUtils.js';
import { DragDropHandler } from './scrapbook/dragDrop.js';
import { renderMarkdownCell } from './scrapbook/markdownCell.js';
import { renderQueryResultCell } from './scrapbook/queryResultCell.js';
import { renderSectionCell } from './scrapbook/sectionCell.js';
import { renderSnapshotCell } from './scrapbook/snapshotCell.js';

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

    const addSectionBtn = el('button', { class: 'scrapbook-add-btn' }, '+ Section');
    addSectionBtn.addEventListener('click', () => this.addSectionCell());
    footer.appendChild(addSectionBtn);
    this.container.appendChild(footer);

    this.renderCells();
  }

  // ── Cell list rendering ───────────────────────────────────────────────────────

  private renderCells(): void {
    clearChildren(this.cellListEl);
    const cells = this.store.getCells();
    if (cells.length === 0) {
      const empty = el(
        'div',
        { class: 'scrapbook-empty' },
        'まだセルがありません。グラフからスナップショットを送るか、「+ Note」でメモを追加してください。',
      );
      this.cellListEl.appendChild(empty);
      return;
    }
    const dragDrop = new DragDropHandler(this.cellListEl, this.store);
    cells.forEach((cell, index) => {
      const cellEl = this.renderCell(cell);
      dragDrop.attachDragHandlers(cellEl, index);
      this.cellListEl.appendChild(cellEl);
    });
  }

  private renderCell(cell: ScrapbookCell): HTMLElement {
    switch (cell.kind) {
      case 'markdown':
        return renderMarkdownCell(cell, this.store);
      case 'query-result':
        return renderQueryResultCell(cell, this.store);
      case 'snapshot':
        return renderSnapshotCell(cell, this.store);
      case 'section':
        return renderSectionCell(cell, this.store);
    }
  }

  // ── Cell addition ─────────────────────────────────────────────────────────────

  private addSectionCell(): void {
    const cell: SectionCell = {
      id: crypto.randomUUID(),
      kind: 'section',
      createdAt: Date.now(),
      title: 'セクション',
    };
    this.store.addCell(cell);
    requestAnimationFrame(() => {
      this.cellListEl.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  private addMarkdownCell(): void {
    const cell: MarkdownCell = {
      id: crypto.randomUUID(),
      kind: 'markdown',
      createdAt: Date.now(),
      content: '',
    };
    this.store.addCell(cell);
    requestAnimationFrame(() => {
      this.cellListEl.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
