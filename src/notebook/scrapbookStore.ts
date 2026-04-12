import type { ScrapbookCell, MarkdownCell, QueryResultCell, SnapshotCell, SectionCell } from '../types.js';

const STORAGE_KEY = 'graphnote:scrapbook';

export class ScrapbookStore {
  private cells: ScrapbookCell[] = [];
  private changeListeners: Array<() => void> = [];

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('graphnote:notebook');
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cells = parsed as ScrapbookCell[];
        }
      }
    } catch {
      this.cells = [];
    }
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cells));
  }

  addCell(cell: ScrapbookCell): void {
    this.cells.push(cell);
    this.save();
    this.notify();
  }

  reorderCells(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const cells = this.cells;
    const [moved] = cells.splice(fromIndex, 1);
    if (!moved) return;
    cells.splice(toIndex, 0, moved);
    this.save();
    this.notify();
  }

  updateCell(id: string, patch: Partial<MarkdownCell> | Partial<QueryResultCell> | Partial<SnapshotCell> | Partial<SectionCell>, silent = false): void {
    const idx = this.cells.findIndex((c) => c.id === id);
    if (idx === -1) return;
    this.cells[idx] = { ...this.cells[idx], ...patch } as ScrapbookCell;
    this.save();
    if (!silent) this.notify();
  }

  deleteCell(id: string): void {
    this.cells = this.cells.filter((c) => c.id !== id);
    this.save();
    this.notify();
  }

  getCells(): ScrapbookCell[] {
    return [...this.cells];
  }

  onChange(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  private notify(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}
