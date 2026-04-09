import type { NotebookCell, MarkdownCell, QueryResultCell, SnapshotCell } from '../types.js';

const STORAGE_KEY = 'graphnote:notebook';

export class NotebookStore {
  private cells: NotebookCell[] = [];
  private changeListeners: Array<() => void> = [];

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.cells = parsed as NotebookCell[];
        }
      }
    } catch {
      this.cells = [];
    }
  }

  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cells));
  }

  addCell(cell: NotebookCell): void {
    this.cells.push(cell);
    this.save();
    this.notify();
  }

  updateCell(id: string, patch: Partial<MarkdownCell> | Partial<QueryResultCell> | Partial<SnapshotCell>, silent = false): void {
    const idx = this.cells.findIndex((c) => c.id === id);
    if (idx === -1) return;
    this.cells[idx] = { ...this.cells[idx], ...patch } as NotebookCell;
    this.save();
    if (!silent) this.notify();
  }

  deleteCell(id: string): void {
    this.cells = this.cells.filter((c) => c.id !== id);
    this.save();
    this.notify();
  }

  getCells(): NotebookCell[] {
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
