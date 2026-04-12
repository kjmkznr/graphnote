import type { SidebarContext } from '../appContext.js';
import { showToast } from '../ui/toast.js';

export function setupSidebarCallbacks(ctx: SidebarContext): void {
  ctx.sidebar.onLabelChange((gnId, oldLabel, newLabel) => {
    ctx.captureForUndo();
    ctx.db.relabelNode(gnId, oldLabel, newLabel);
    ctx.canvas.refreshGraph(ctx.db.getAllNodes(), ctx.db.getAllEdges());
    ctx.scheduleSave();
  });

  ctx.sidebar.onNoteChange((gnId, note) => {
    ctx.db.updateNodeProperty(gnId, 'note', note);
    ctx.scheduleSave();
  });

  ctx.sidebar.onPropertyChange((gnId, key, value) => {
    try {
      ctx.captureForUndo();
      ctx.db.updateNodeProperty(gnId, key, value);
      ctx.scheduleSave();
    } catch (err) {
      showToast(String(err), 'warn');
    }
  });

  ctx.sidebar.onAddProperty((gnId, key, value) => {
    try {
      ctx.captureForUndo();
      ctx.db.updateNodeProperty(gnId, key, value);
      const node = ctx.db.getNodeByGnId(gnId);
      if (node) ctx.sidebar.showNode(node);
      ctx.scheduleSave();
    } catch (err) {
      showToast(String(err), 'warn');
    }
  });
}
