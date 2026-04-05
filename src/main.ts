import { GraphDB } from './graph/db.js';
import { saveGraph, loadGraph, clearSaved } from './graph/persistence.js';
import { TypeRegistry } from './graph/typeRegistry.js';
import { Canvas } from './ui/canvas.js';
import { Sidebar } from './ui/sidebar.js';
import { QueryPanel } from './ui/queryPanel.js';
import { initResizers } from './ui/resizer.js';
import { showCreateNodeDialog } from './ui/createNodeDialog.js';
import { showTypeManagerDialog } from './ui/typeManagerDialog.js';
import type { InteractionMode } from './types.js';

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

  function promptEdgeType(): string | null {
    return window.prompt('エッジのタイプ (例: DEPENDS_ON, KNOWS, USES):', 'RELATES_TO');
  }

  function refreshAndSave(): void {
    canvas.refreshGraph(db.getAllNodes(), db.getAllEdges());
    scheduleSave();
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
        const type = promptEdgeType();
        if (!type) break;
        try {
          db.createEdge(event.sourceGnId, event.targetGnId, type);
          refreshAndSave();
        } catch (err) {
          console.error('Failed to create edge:', err);
        }
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
    const t0 = performance.now();
    try {
      const rows = db.execute(query);
      const elapsed = performance.now() - t0;
      queryPanel.showResult(rows, elapsed);
      canvas.refreshGraph(db.getAllNodes(), db.getAllEdges());
      scheduleSave();
    } catch (err) {
      queryPanel.showError(String(err));
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

  // ── Resize handles ──────────────────────────────────────────────────────────

  initResizers(() => canvas.resize());

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
