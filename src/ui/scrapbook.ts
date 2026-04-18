import type { ScrapbookStore } from '../notebook/scrapbookStore.js';
import type { MarkdownCell, ScrapbookCell, SectionCell } from '../types.js';
import { clearChildren, el } from './domUtils.js';
import { DragDropHandler } from './scrapbook/dragDrop.js';
import { renderMarkdownCell } from './scrapbook/markdownCell.js';
import { renderQueryResultCell } from './scrapbook/queryResultCell.js';
import { renderSectionCell } from './scrapbook/sectionCell.js';
import { renderSnapshotCell } from './scrapbook/snapshotCell.js';

type FilterKind = 'all' | 'snapshot' | 'markdown' | 'query-result';

export class Scrapbook {
  private container: HTMLElement;
  private store: ScrapbookStore;
  private cellListEl!: HTMLElement;
  private railEl!: HTMLElement;
  private statsEl!: HTMLElement;
  private filter: FilterKind = 'all';

  constructor(container: HTMLElement, store: ScrapbookStore) {
    this.container = container;
    this.store = store;
    this.render();
    this.store.onChange(() => this.refresh());
  }

  // ── Initial render ──────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'scrapbook-root';

    // Left rail
    this.railEl = el('div', { class: 'scrap-rail' });
    this.container.appendChild(this.railEl);

    // Right main
    const main = el('div', { class: 'scrapbook-main' });

    const head = el('div', { class: 'scrap-head' });
    head.appendChild(el('h2', {}, 'Scrapbook'));
    this.statsEl = el('div', { class: 'scrap-head-meta' });
    head.appendChild(this.statsEl);
    main.appendChild(head);

    this.cellListEl = el('div', { class: 'scrap-list' });
    main.appendChild(this.cellListEl);
    this.container.appendChild(main);

    this.refresh();
  }

  // ── Full refresh ────────────────────────────────────────────────────────────

  private refresh(): void {
    this.renderRail();
    this.renderStats();
    this.renderCells();
  }

  // ── Rail ────────────────────────────────────────────────────────────────────

  private renderRail(): void {
    clearChildren(this.railEl);
    const cells = this.store.getCells();
    const counts: Record<FilterKind, number> = {
      all: cells.filter((c) => c.kind !== 'section').length,
      snapshot: cells.filter((c) => c.kind === 'snapshot').length,
      markdown: cells.filter((c) => c.kind === 'markdown').length,
      'query-result': cells.filter((c) => c.kind === 'query-result').length,
    };

    // Filter section
    const filterSection = el('div', { class: 'rail-section' });
    filterSection.appendChild(el('div', { class: 'rail-label' }, 'Filter'));

    const filters: { id: FilterKind; label: string }[] = [
      { id: 'all', label: 'All' },
      { id: 'snapshot', label: 'Snapshots' },
      { id: 'markdown', label: 'Notes' },
      { id: 'query-result', label: 'Cypher' },
    ];

    for (const f of filters) {
      const btn = el('button', { class: 'scrap-rail-item' });
      if (this.filter === f.id) btn.setAttribute('data-active', 'true');
      btn.appendChild(el('span', { style: 'flex:1' }, f.label));
      btn.appendChild(el('span', { class: 'scrap-rail-count' }, String(counts[f.id])));
      btn.addEventListener('click', () => {
        this.filter = f.id;
        this.refresh();
      });
      filterSection.appendChild(btn);
    }
    this.railEl.appendChild(filterSection);

    // Actions section
    const actSection = el('div', { class: 'rail-section' });
    actSection.appendChild(el('div', { class: 'rail-label' }, 'Actions'));

    const addNoteBtn = el('button', { class: 'rail-btn' }, '+ Note');
    addNoteBtn.addEventListener('click', () => this.addMarkdownCell());
    actSection.appendChild(addNoteBtn);

    const addSectionBtn = el('button', { class: 'rail-btn' }, '+ Section');
    addSectionBtn.addEventListener('click', () => this.addSectionCell());
    actSection.appendChild(addSectionBtn);

    this.railEl.appendChild(actSection);
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  private renderStats(): void {
    clearChildren(this.statsEl);
    const cells = this.store.getCells();
    const stat = (label: string, value: number): HTMLElement => {
      const d = el('div', {});
      d.textContent = `${label} `;
      d.appendChild(el('span', {}, String(value)));
      return d;
    };
    this.statsEl.appendChild(stat('Total', cells.filter((c) => c.kind !== 'section').length));
    this.statsEl.appendChild(stat('Snapshots', cells.filter((c) => c.kind === 'snapshot').length));
    this.statsEl.appendChild(stat('Notes', cells.filter((c) => c.kind === 'markdown').length));
    this.statsEl.appendChild(stat('Cypher', cells.filter((c) => c.kind === 'query-result').length));
  }

  // ── Cell list ───────────────────────────────────────────────────────────────

  private renderCells(): void {
    clearChildren(this.cellListEl);
    const cells = this.store.getCells();
    const visible = cells.filter(
      (c) => this.filter === 'all' || c.kind === 'section' || c.kind === this.filter,
    );
    const contentCount = visible.filter((c) => c.kind !== 'section').length;

    if (contentCount === 0) {
      this.cellListEl.appendChild(
        el(
          'div',
          { class: 'scrapbook-empty' },
          'まだセルがありません。グラフからスナップショットを送るか、「+ Note」でメモを追加してください。',
        ),
      );
      return;
    }

    const dragDrop = new DragDropHandler(this.cellListEl, this.store);
    cells.forEach((cell, index) => {
      if (this.filter !== 'all' && cell.kind !== 'section' && cell.kind !== this.filter) return;
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

  // ── Cell addition ───────────────────────────────────────────────────────────

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
