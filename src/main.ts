import './styles/main.css';
import { GraphDB } from './graph/db.js';
import { saveGraph, loadGraph, clearSaved, exportToFile, importFromFile } from './graph/persistence.js';
import { TypeRegistry } from './graph/typeRegistry.js';
import { Canvas } from './ui/canvas.js';
import { Sidebar } from './ui/sidebar.js';
import { QueryPanel } from './ui/queryPanel.js';
import { initResizers } from './ui/resizer.js';
import { showCreateNodeDialog } from './ui/createNodeDialog.js';
import { showTypeManagerDialog } from './ui/typeManagerDialog.js';
import { showCreateEdgeDialog } from './ui/createEdgeDialog.js';
import { showToast } from './ui/toast.js';
import type { InteractionMode } from './types.js';

// ── Query result gnId extraction ─────────────────────────────────────────────

function extractMatchedGnIds(rows: unknown[]): { nodeGnIds: Set<string>; edgeGnIds: Set<string> } {
  const nodeGnIds = new Set<string>();
  const edgeGnIds = new Set<string>();
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    for (const val of Object.values(row as Record<string, unknown>)) {
      if (typeof val !== 'object' || val === null) continue;
      const v = val as Record<string, unknown>;
      if (Array.isArray(v['_labels']) && typeof v['_properties'] === 'object' && v['_properties'] !== null) {
        const gnId = (v['_properties'] as Record<string, unknown>)['gnId'];
        if (typeof gnId === 'string') nodeGnIds.add(gnId);
      } else if (typeof v['_type'] === 'string' && '_src' in v && '_dst' in v && typeof v['_properties'] === 'object' && v['_properties'] !== null) {
        const gnId = (v['_properties'] as Record<string, unknown>)['gnId'];
        if (typeof gnId === 'string') edgeGnIds.add(gnId);
      }
    }
  }
  return { nodeGnIds, edgeGnIds };
}

// ── Context Menu ──────────────────────────────────────────────────────────────

const ctxMenu = document.getElementById('context-menu')!;

type MenuItem = { label: string; danger?: boolean; action: () => void };

function showContextMenu(items: MenuItem[], x: number, y: number): void {
  ctxMenu.innerHTML = items
    .map((item, i) => `<button class="ctx-item${item.danger ? ' danger' : ''}" data-idx="${i}">${item.label}</button>`)
    .join('');

  ctxMenu.querySelectorAll<HTMLButtonElement>('.ctx-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      items[Number(btn.dataset['idx'])]?.action();
      hideContextMenu();
    });
  });

  ctxMenu.style.left = `${x}px`;
  ctxMenu.style.top = `${y}px`;
  ctxMenu.style.display = 'block';

  requestAnimationFrame(() => {
    const rect = ctxMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) ctxMenu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) ctxMenu.style.top = `${y - rect.height}px`;
  });

  setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 0);
}

function hideContextMenu(): void {
  ctxMenu.style.display = 'none';
}

// ── App ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = new GraphDB();
  await db.init();

  const registry = new TypeRegistry();
  const savedPositions = await loadGraph(db);

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveGraph(db, canvas.getPositions());
      updateStats();
    }, 300);
  }

  function updateStats(): void {
    const nc = document.getElementById('node-count');
    const ec = document.getElementById('edge-count');
    if (nc) nc.textContent = String(db.nodeCount());
    if (ec) ec.textContent = String(db.edgeCount());
  }

  function refreshAndSave(): void {
    try {
      canvas.refreshGraph(db.getAllNodes(), db.getAllEdges());
      scheduleSave();
    } catch (err) {
      showToast(`グラフの更新に失敗しました: ${String(err)}`);
      console.error('refreshAndSave failed:', err);
    }
  }

  // ── Canvas ──────────────────────────────────────────────────────────────────

  const canvas = new Canvas(document.getElementById('cy')!, (event) => {
    switch (event.kind) {
      case 'canvas-clicked': {
        const clickPos = event.position;
        showCreateNodeDialog(registry).then((result) => {
          if (!result) return;
          registry.ensure(result.type);
          const gnId = db.createNode(result.type, { name: result.name });
          canvas.hintPosition(gnId, clickPos);
          refreshAndSave();
        });
        break;
      }

      case 'node-clicked': {
        const node = db.getNodeByGnId(event.gnId);
        if (node) sidebar.showNode(node);
        break;
      }

      case 'edge-clicked': {
        const edge = db.getEdgeByGnId(event.gnId);
        if (edge) sidebar.showEdge(edge);
        break;
      }

      case 'edge-created': {
        const { sourceGnId, targetGnId } = event;
        showCreateEdgeDialog().then((type) => {
          if (!type) return;
          try {
            db.createEdge(sourceGnId, targetGnId, type);
            refreshAndSave();
          } catch (err) {
            showToast(`エッジの作成に失敗しました: ${String(err)}`);
            console.error('Failed to create edge:', err);
          }
        });
        break;
      }

      case 'node-context':
        showContextMenu(
          [{
            label: 'ノードを削除', danger: true,
            action: () => {
              db.deleteNode(event.gnId);
              sidebar.hide();
              refreshAndSave();
            },
          }],
          event.x, event.y,
        );
        break;

      case 'edge-context':
        showContextMenu(
          [{
            label: 'エッジを削除', danger: true,
            action: () => {
              db.deleteEdge(event.gnId);
              sidebar.hide();
              refreshAndSave();
            },
          }],
          event.x, event.y,
        );
        break;

      case 'bg-context':
        showContextMenu(
          [{
            label: 'ノードを作成',
            action: () => {
              showCreateNodeDialog(registry).then((result) => {
                if (!result) return;
                registry.ensure(result.type);
                db.createNode(result.type, { name: result.name });
                refreshAndSave();
              });
            },
          }],
          event.x, event.y,
        );
        break;
    }
  });

  // ── Sidebar ─────────────────────────────────────────────────────────────────

  const sidebar = new Sidebar();
  sidebar.setRegistry(registry);

  sidebar.onLabelChange((gnId, oldLabel, newLabel) => {
    db.relabelNode(gnId, oldLabel, newLabel);
    canvas.refreshGraph(db.getAllNodes(), db.getAllEdges());
    scheduleSave();
  });

  sidebar.onNoteChange((gnId, note) => {
    db.updateNodeProperty(gnId, 'note', note);
    scheduleSave();
  });

  sidebar.onPropertyChange((gnId, key, value) => {
    db.updateNodeProperty(gnId, key, value);
    scheduleSave();
  });

  sidebar.onAddProperty((gnId, key, value) => {
    db.updateNodeProperty(gnId, key, value);
    const node = db.getNodeByGnId(gnId);
    if (node) sidebar.showNode(node);
    scheduleSave();
  });

  // ── Query Panel ─────────────────────────────────────────────────────────────

  const queryPanel = new QueryPanel();

  queryPanel.onExecute((query) => {
    canvas.clearHighlight();
    const t0 = performance.now();
    try {
      const rows = db.execute(query);
      const elapsed = performance.now() - t0;
      queryPanel.showResult(rows, elapsed);
      canvas.refreshGraph(db.getAllNodes(), db.getAllEdges());
      scheduleSave();
      const { nodeGnIds, edgeGnIds } = extractMatchedGnIds(rows);
      canvas.highlightByGnId(nodeGnIds, edgeGnIds);
    } catch (err) {
      queryPanel.showError(String(err));
      showToast(String(err), 'warn');
    }
  });

  // ── Mode buttons ─────────────────────────────────────────────────────────────

  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      canvas.setMode(btn.dataset['mode'] as InteractionMode);
    });
  });

  document.getElementById('fit-btn')?.addEventListener('click', () => canvas.fitView());

  document.getElementById('types-btn')?.addEventListener('click', () => {
    showTypeManagerDialog(registry);
  });

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (!window.confirm('グラフをリセットしますか？この操作は取り消せません。')) return;
    db.reset();
    clearSaved();
    sidebar.hide();
    canvas.refreshGraph([], []);
    updateStats();
  });

  document.getElementById('export-btn')?.addEventListener('click', () => {
    exportToFile(db, canvas.getPositions());
    showToast('エクスポートしました');
  });

  document.getElementById('import-btn')?.addEventListener('click', () => {
    importFromFile(db).then((positions) => {
      if (positions === null) {
        showToast('インポートをキャンセルしました', 'warn');
        return;
      }
      saveGraph(db, positions);
      sidebar.hide();
      canvas.refreshGraph(db.getAllNodes(), db.getAllEdges(), positions);
      updateStats();
      showToast('インポートしました');
    });
  });

  // ── Resize handles ──────────────────────────────────────────────────────────

  initResizers(
    () => canvas.resize(),
    () => canvas.clearHighlight(),
  );

  // ── Initial render ──────────────────────────────────────────────────────────

  canvas.refreshGraph(db.getAllNodes(), db.getAllEdges(), savedPositions);
  updateStats();

  document.getElementById('loading')?.remove();
}

main().catch((err) => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `
      <div style="color:#f87171;font-size:14px;text-align:center;padding:24px;max-width:480px">
        <p style="margin-bottom:8px;font-weight:bold">初期化エラー</p>
        <p style="font-family:monospace;font-size:12px;word-break:break-all">${String(err)}</p>
      </div>
    `;
  }
  console.error('Failed to initialize graphnote:', err);
});
