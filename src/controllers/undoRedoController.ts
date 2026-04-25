import type { UndoContext } from '../appContext.js';
import { UndoManager } from '../graph/undoManager.js';
import { DOM_IDS } from '../ui/domIds.js';
import { byId } from '../ui/domUtils.js';

export function setupUndoRedo(ctx: UndoContext): void {
  const elUndoBtn = byId<HTMLButtonElement>(DOM_IDS.undoBtn);
  const elRedoBtn = byId<HTMLButtonElement>(DOM_IDS.redoBtn);

  function updateButtons(): void {
    elUndoBtn.disabled = !ctx.undoManager.canUndo();
    elRedoBtn.disabled = !ctx.undoManager.canRedo();
  }

  function performUndo(): void {
    if (!ctx.undoManager.canUndo()) return;
    const current = UndoManager.captureSnapshot(ctx.db, ctx.canvas.getPositions());
    const prev = ctx.undoManager.undo(current);
    if (!prev) return;
    const positions = UndoManager.restoreSnapshot(ctx.db, prev);
    ctx.db.applyConstraints(ctx.registry.getAll());
    ctx.sidebar.hide();
    ctx.updateNodeTypeFilterOptions();
    ctx.canvas.refreshGraph(ctx.getFilteredNodes(), ctx.getFilteredEdges(), positions);
    ctx.scheduleSave();
  }

  function performRedo(): void {
    if (!ctx.undoManager.canRedo()) return;
    const current = UndoManager.captureSnapshot(ctx.db, ctx.canvas.getPositions());
    const next = ctx.undoManager.redo(current);
    if (!next) return;
    const positions = UndoManager.restoreSnapshot(ctx.db, next);
    ctx.db.applyConstraints(ctx.registry.getAll());
    ctx.sidebar.hide();
    ctx.updateNodeTypeFilterOptions();
    ctx.canvas.refreshGraph(ctx.getFilteredNodes(), ctx.getFilteredEdges(), positions);
    ctx.scheduleSave();
  }

  ctx.undoManager.onChange(() => updateButtons());
  updateButtons();

  elUndoBtn.addEventListener('click', () => performUndo());
  elRedoBtn.addEventListener('click', () => performRedo());

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      performUndo();
    }
    if ((e.key === 'Z' && e.shiftKey) || (e.key === 'y' && !e.shiftKey)) {
      e.preventDefault();
      performRedo();
    }
  });
}
