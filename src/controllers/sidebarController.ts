import type { SidebarContext } from '../appContext.js';
import { showToast } from '../ui/toast.js';

export function setupSidebarCallbacks(ctx: SidebarContext): void {
  ctx.sidebar.setCallbacks({
    onLabelChange(gnId, oldLabel, newLabel) {
      ctx.captureForUndo();
      ctx.db.relabelNode(gnId, oldLabel, newLabel);
      ctx.canvas.refreshGraph(
        ctx.db.getAllNodes(),
        ctx.db.getAllEdges(),
        undefined,
        ctx.groupStore.list(),
      );
      ctx.scheduleSave();
    },
    onNoteChange(gnId, note) {
      if (ctx.sidebar.getCurrentType() === 'edge') {
        ctx.db.updateEdgeProperty(gnId, 'note', note);
      } else {
        ctx.db.updateNodeProperty(gnId, 'note', note);
      }
      ctx.scheduleSave();
    },
    onPropertyChange(gnId, key, value) {
      try {
        ctx.captureForUndo();
        if (ctx.sidebar.getCurrentType() === 'edge') {
          ctx.db.updateEdgeProperty(gnId, key, value);
        } else {
          ctx.db.updateNodeProperty(gnId, key, value);
        }
        ctx.canvas.refreshGraph(
          ctx.db.getAllNodes(),
          ctx.db.getAllEdges(),
          undefined,
          ctx.groupStore.list(),
        );
        ctx.scheduleSave();
      } catch (err) {
        showToast(String(err), 'warn');
      }
    },
    onAddProperty(gnId, key, value) {
      try {
        ctx.captureForUndo();
        if (ctx.sidebar.getCurrentType() === 'edge') {
          ctx.db.updateEdgeProperty(gnId, key, value);
          const edge = ctx.db.getEdgeByGnId(gnId);
          if (edge) ctx.sidebar.showEdge(edge);
        } else {
          ctx.db.updateNodeProperty(gnId, key, value);
          const node = ctx.db.getNodeByGnId(gnId);
          if (node) ctx.sidebar.showNode(node);
        }
        ctx.scheduleSave();
      } catch (err) {
        showToast(String(err), 'warn');
      }
    },
    onGroupRename(id, name) {
      ctx.groupStore.rename(id, name);
      ctx.refreshAndSave();
    },
    onGroupColorChange(id, color) {
      ctx.groupStore.setColor(id, color);
      ctx.refreshAndSave();
    },
    onGroupNoteChange(id, note) {
      ctx.groupStore.setNote(id, note);
      ctx.scheduleSave();
    },
    onGroupCollapseToggle(id) {
      const g = ctx.groupStore.get(id);
      if (!g) return;
      ctx.captureForUndo();
      // When collapsing, remember the current group position so we can restore it on expand.
      if (!g.collapsed) {
        const groupPositions = ctx.canvas.getGroupPositions();
        const pos = groupPositions[id];
        if (pos) ctx.groupStore.setPosition(id, pos);
      }
      ctx.groupStore.setCollapsed(id, !g.collapsed);
      ctx.refreshAndSave();
      const updated = ctx.groupStore.get(id);
      if (updated) ctx.sidebar.showGroup(updated);
    },
    onGroupDelete(id) {
      ctx.captureForUndo();
      // Clear group property from any nodes that referenced this group.
      for (const n of ctx.db.getAllNodes()) {
        if ((n._properties.group as string | undefined) === id) {
          const nodeGnId = n._properties.gnId as string | undefined;
          if (nodeGnId) ctx.db.setNodeGroup(nodeGnId as import('../types.js').GnId, null);
        }
      }
      ctx.groupStore.remove(id);
      ctx.sidebar.hide();
      ctx.refreshAndSave();
    },
  });
}
