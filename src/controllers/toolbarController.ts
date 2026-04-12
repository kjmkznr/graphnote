import type { ToolbarContext } from '../appContext.js';
import type { InteractionMode } from '../types.js';
import { saveGraph, clearSaved, exportToFile, exportToCypher, loadFromJson } from '../graph/persistence.js';
import { buildShareUrl } from '../graph/urlShare.js';
import { UndoManager } from '../graph/undoManager.js';
import { showNodeTypeStyleDialog } from '../ui/nodeTypeStyleDialog.js';
import { showEdgeTypeStyleDialog } from '../ui/edgeTypeStyleDialog.js';
import { showCsvImportDialog } from '../ui/csvImportDialog.js';
import { importCsv } from '../graph/csvImport.js';
import { showToast } from '../ui/toast.js';
import { byId } from '../ui/domUtils.js';

async function openFilePicker(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });

    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function setupModeControls(ctx: ToolbarContext): void {
  const elAddNodeBtn = byId('add-node-btn');
  const elActionBtns = byId('canvas-action-btns');

  function applyMode(mode: InteractionMode): void {
    ctx.canvas.setMode(mode);
    elAddNodeBtn.classList.toggle('active', mode === 'node');
    elActionBtns.style.display = 'flex';
  }

  elAddNodeBtn.addEventListener('click', () => {
    applyMode(ctx.canvas.getMode() === 'node' ? 'edit' : 'node');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ctx.canvas.getMode() === 'node') applyMode('edit');
  });

  applyMode('edit');
}

export function setupToolbarButtons(ctx: ToolbarContext): void {
  byId('fit-btn')?.addEventListener('click', () => ctx.canvas.fitView());

  byId('types-btn')?.addEventListener('click', () => {
    showNodeTypeStyleDialog(ctx.registry).then(() => {
      ctx.canvas.updateNodeStyles(ctx.registry);
      ctx.canvas.refreshGraph(ctx.db.getAllNodes(), ctx.db.getAllEdges());
    });
  });

  byId('edge-types-btn')?.addEventListener('click', () => {
    showEdgeTypeStyleDialog(ctx.edgeRegistry).then(() => {
      ctx.canvas.updateEdgeStyles(ctx.edgeRegistry);
    });
  });

  byId('reset-btn')?.addEventListener('click', () => {
    if (!window.confirm('グラフをリセットしますか？')) return;
    ctx.captureForUndo();
    ctx.db.reset();
    clearSaved().catch((err) => console.warn('Failed to clear saved graph:', err));
    ctx.scrapbookStore.clear();
    ctx.sidebar.hide();
    ctx.canvas.refreshGraph([], []);
    ctx.updateStats();
  });

  byId('export-json-btn')?.addEventListener('click', () => {
    exportToFile(ctx.db, ctx.canvas.getPositions());
    showToast('JSON形式でエクスポートしました', 'success');
  });

  byId('export-cypher-btn')?.addEventListener('click', () => {
    exportToCypher(ctx.db, ctx.canvas.getPositions());
    showToast('Cypher形式でエクスポートしました', 'success');
  });

  byId('share-btn')?.addEventListener('click', () => {
    buildShareUrl(ctx.db, ctx.canvas.getPositions(), ctx.canvas.getViewport())
      .then((url) => {
        if (!url) {
          showToast('共有するノードがありません', 'warn');
          return;
        }
        if (url.length > 100_000) {
          showToast('グラフが大きすぎるためURLでの共有ができません。JSON エクスポートをご利用ください。', 'warn');
          return;
        }
        return navigator.clipboard.writeText(url).then(() => {
          showToast('共有 URL をクリップボードにコピーしました', 'success');
        });
      })
      .catch((err) => {
        showToast(`共有 URL の生成に失敗しました: ${String(err)}`, 'warn');
      });
  });

  byId('import-json-btn')?.addEventListener('click', () => {
    const snapshotBeforeImport = UndoManager.captureSnapshot(ctx.db, ctx.canvas.getPositions());
    openFilePicker().then((json) => {
      if (json === null) {
        showToast('インポートをキャンセルしました', 'warn');
        return;
      }
      const result = loadFromJson(ctx.db, json);
      if (result === null) {
        showToast('インポートに失敗しました', 'warn');
        return;
      }
      ctx.undoManager.pushState(snapshotBeforeImport);
      saveGraph(ctx.db, result.positions).catch((err) => console.warn('Failed to save graph:', err));
      ctx.sidebar.hide();
      ctx.canvas.refreshGraph(ctx.db.getAllNodes(), ctx.db.getAllEdges(), result.positions);
      ctx.updateStats();
      showToast('インポートしました', 'success');
    });
  });

  byId('import-csv-btn')?.addEventListener('click', () => {
    showCsvImportDialog(ctx.registry).then((result) => {
      if (!result) {
        showToast('CSVインポートをキャンセルしました', 'warn');
        return;
      }
      try {
        ctx.captureForUndo();
        const { nodeCount, edgeCount, skippedEdges } = importCsv(ctx.db, result.csvText, result.options);
        for (const edge of ctx.db.getAllEdges()) {
          ctx.edgeRegistry.ensure(edge._type);
        }
        ctx.registry.ensure(result.options.nodeLabel);
        ctx.refreshAndSave();
        const msg = `CSVインポート完了: ノード ${nodeCount} 件、エッジ ${edgeCount} 件` +
          (skippedEdges > 0 ? `（スキップ ${skippedEdges} 件）` : '');
        showToast(msg, 'success');
      } catch (err) {
        showToast(`CSVインポートに失敗しました: ${String(err)}`, 'warn');
      }
    });
  });
}
