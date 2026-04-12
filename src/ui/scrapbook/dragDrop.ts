import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';

export class DragDropHandler {
  private dragSrcIndex: number = -1;
  private cellListEl: HTMLElement;
  private store: ScrapbookStore;

  constructor(cellListEl: HTMLElement, store: ScrapbookStore) {
    this.cellListEl = cellListEl;
    this.store = store;
  }

  private clearInsertIndicators(): void {
    this.cellListEl.querySelectorAll('.nb-cell-drag-insert-before, .nb-cell-drag-insert-after').forEach(el => {
      el.classList.remove('nb-cell-drag-insert-before', 'nb-cell-drag-insert-after');
    });
  }

  private getInsertPosition(cellEl: HTMLElement, e: DragEvent): 'before' | 'after' {
    const rect = cellEl.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  attachDragHandlers(cellEl: HTMLElement, index: number): void {
    cellEl.setAttribute('draggable', 'true');
    cellEl.dataset['dragIndex'] = String(index);

    cellEl.addEventListener('dragstart', (e: DragEvent) => {
      this.dragSrcIndex = index;
      cellEl.classList.add('nb-cell-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      }
    });

    cellEl.addEventListener('dragend', () => {
      cellEl.classList.remove('nb-cell-dragging');
      this.clearInsertIndicators();
    });

    cellEl.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      if (index === this.dragSrcIndex) return;
      this.clearInsertIndicators();
      const pos = this.getInsertPosition(cellEl, e);
      cellEl.classList.add(pos === 'before' ? 'nb-cell-drag-insert-before' : 'nb-cell-drag-insert-after');
    });

    cellEl.addEventListener('dragleave', () => {
      cellEl.classList.remove('nb-cell-drag-insert-before', 'nb-cell-drag-insert-after');
    });

    cellEl.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const pos = this.getInsertPosition(cellEl, e);
      cellEl.classList.remove('nb-cell-drag-insert-before', 'nb-cell-drag-insert-after');
      if (this.dragSrcIndex !== -1 && this.dragSrcIndex !== index) {
        const toIndex = pos === 'before' ? index : index + 1;
        const adjustedTo = this.dragSrcIndex < toIndex ? toIndex - 1 : toIndex;
        this.store.reorderCells(this.dragSrcIndex, adjustedTo);
      }
      this.dragSrcIndex = -1;
    });
  }
}
