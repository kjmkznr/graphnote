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
import type { CanvasEvent, InteractionMode } from './types.js';

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

type MenuItem = { label: string; danger?: boolean; action: () => void };

function showContextMenu(ctxMenu: HTMLElement, items: MenuItem[], x: number, y: number): void {
  ctxMenu.innerHTML = items
    .map((item, i) => `<button class="ctx-item${item.danger ? ' danger' : ''}" data-idx="${i}">${item.label}</button>`)
    .join('');

  ctxMenu.querySelectorAll<HTMLButtonElement>('.ctx-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      items[Number(btn.dataset['idx'])]?.action();
      hideContextMenu(ctxMenu);
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

  setTimeout(() => document.addEventListener('click', () => hideContextMenu(ctxMenu), { once: true }), 0);
}

function hideContextMenu(ctxMenu: HTMLElement): void {
  ctxMenu.style.display = 'none';
}

// ── App ───────────────────────────────────────────────────────────────────────

export class App {
  private db!: GraphDB;
  private canvas!: Canvas;
  private sidebar!: Sidebar;
  private queryPanel!: QueryPanel;
  private registry!: TypeRegistry;

  private ctxMenu = document.getElementById('context-menu')!;
  private elToggle = document.getElementById('view-edit-toggle')!;
  private elActionBtns = document.getElementById('canvas-action-btns')!;
  private elAddNodeBtn = document.getElementById('add-node-btn')!;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    this.db = new GraphDB();
    await this.db.init();

    this.registry = new TypeRegistry();
    const savedPositions = await loadGraph(this.db);

    this.canvas = new Canvas(document.getElementById('cy')!, (event) => this.handleCanvasEvent(event));

    this.sidebar = new Sidebar();
    this.sidebar.setRegistry(this.registry);
    this.setupSidebarCallbacks();

    this.queryPanel = new QueryPanel();
    this.setupQueryPanel();

    this.setupModeControls();
    this.setupToolbarButtons();

    initResizers(
      () => this.canvas.resize(),
      () => this.canvas.clearHighlight(),
    );

    this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges(), savedPositions);
    this.updateStats();

    document.getElementById('loading')?.remove();
  }

  // ── Canvas event dispatch ────────────────────────────────────────────────────

  private handleCanvasEvent(event: CanvasEvent): void {
    switch (event.kind) {
      case 'canvas-clicked':   return this.handleCanvasClicked(event.position);
      case 'node-clicked':     return this.handleNodeClicked(event.gnId);
      case 'edge-clicked':     return this.handleEdgeClicked(event.gnId);
      case 'edge-created':     return this.handleEdgeCreated(event.sourceGnId, event.targetGnId);
      case 'edge-drag-cancelled': return this.applyMode('edit');
      case 'node-context':     return this.handleNodeContext(event.gnId, event.x, event.y);
      case 'edge-context':     return this.handleEdgeContext(event.gnId, event.x, event.y);
      case 'bg-context':       return this.handleBgContext(event.x, event.y);
    }
  }

  private handleCanvasClicked(position: { x: number; y: number }): void {
    showCreateNodeDialog(this.registry).then((result) => {
      this.applyMode('edit');
      if (!result) return;
      this.registry.ensure(result.type);
      const gnId = this.db.createNode(result.type, { name: result.name });
      this.canvas.hintPosition(gnId, position);
      this.refreshAndSave();
    });
  }

  private handleNodeClicked(gnId: string): void {
    const node = this.db.getNodeByGnId(gnId);
    if (node) this.sidebar.showNode(node);
  }

  private handleEdgeClicked(gnId: string): void {
    const edge = this.db.getEdgeByGnId(gnId);
    if (edge) this.sidebar.showEdge(edge);
  }

  private handleEdgeCreated(sourceGnId: string, targetGnId: string): void {
    showCreateEdgeDialog().then((type) => {
      this.applyMode('edit');
      if (!type) return;
      try {
        this.db.createEdge(sourceGnId, targetGnId, type);
        this.refreshAndSave();
      } catch (err) {
        showToast(`エッジの作成に失敗しました: ${String(err)}`);
        console.error('Failed to create edge:', err);
      }
    });
  }

  private handleNodeContext(gnId: string, x: number, y: number): void {
    showContextMenu(this.ctxMenu, [{
      label: 'ノードを削除', danger: true,
      action: () => {
        this.db.deleteNode(gnId);
        this.sidebar.hide();
        this.refreshAndSave();
      },
    }], x, y);
  }

  private handleEdgeContext(gnId: string, x: number, y: number): void {
    showContextMenu(this.ctxMenu, [{
      label: 'エッジを削除', danger: true,
      action: () => {
        this.db.deleteEdge(gnId);
        this.sidebar.hide();
        this.refreshAndSave();
      },
    }], x, y);
  }

  private handleBgContext(x: number, y: number): void {
    showContextMenu(this.ctxMenu, [{
      label: 'ノードを作成',
      action: () => {
        showCreateNodeDialog(this.registry).then((result) => {
          if (!result) return;
          this.registry.ensure(result.type);
          this.db.createNode(result.type, { name: result.name });
          this.refreshAndSave();
        });
      },
    }], x, y);
  }

  // ── Sidebar callbacks ────────────────────────────────────────────────────────

  private setupSidebarCallbacks(): void {
    this.sidebar.onLabelChange((gnId, oldLabel, newLabel) => {
      this.db.relabelNode(gnId, oldLabel, newLabel);
      this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges());
      this.scheduleSave();
    });

    this.sidebar.onNoteChange((gnId, note) => {
      this.db.updateNodeProperty(gnId, 'note', note);
      this.scheduleSave();
    });

    this.sidebar.onPropertyChange((gnId, key, value) => {
      this.db.updateNodeProperty(gnId, key, value);
      this.scheduleSave();
    });

    this.sidebar.onAddProperty((gnId, key, value) => {
      this.db.updateNodeProperty(gnId, key, value);
      const node = this.db.getNodeByGnId(gnId);
      if (node) this.sidebar.showNode(node);
      this.scheduleSave();
    });
  }

  // ── Query panel ──────────────────────────────────────────────────────────────

  private setupQueryPanel(): void {
    this.queryPanel.onExecute((query) => {
      this.canvas.clearHighlight();
      const t0 = performance.now();
      try {
        const rows = this.db.execute(query);
        const elapsed = performance.now() - t0;
        this.queryPanel.showResult(rows, elapsed);
        this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges());
        this.scheduleSave();
        const { nodeGnIds, edgeGnIds } = extractMatchedGnIds(rows);
        this.canvas.highlightByGnId(nodeGnIds, edgeGnIds);
      } catch (err) {
        this.queryPanel.showError(String(err));
        showToast(String(err), 'warn');
      }
    });
  }

  // ── Mode controls ─────────────────────────────────────────────────────────────

  private applyMode(mode: InteractionMode): void {
    this.canvas.setMode(mode);
    const isEdit = mode === 'edit' || mode === 'node';
    this.elToggle.textContent = isEdit ? 'View' : 'Edit';
    this.elToggle.classList.toggle('active', isEdit);
    this.elActionBtns.style.display = isEdit ? 'flex' : 'none';
    this.elAddNodeBtn.classList.toggle('active', mode === 'node');
  }

  private setupModeControls(): void {
    this.elToggle.addEventListener('click', () => {
      this.applyMode(this.canvas.getMode() === 'view' ? 'edit' : 'view');
    });

    this.elAddNodeBtn.addEventListener('click', () => {
      this.applyMode(this.canvas.getMode() === 'node' ? 'edit' : 'node');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.canvas.getMode() === 'node') this.applyMode('edit');
    });

    this.applyMode('edit');
  }

  // ── Toolbar buttons ───────────────────────────────────────────────────────────

  private setupToolbarButtons(): void {
    document.getElementById('fit-btn')?.addEventListener('click', () => this.canvas.fitView());

    document.getElementById('types-btn')?.addEventListener('click', () => {
      showTypeManagerDialog(this.registry);
    });

    document.getElementById('reset-btn')?.addEventListener('click', () => {
      if (!window.confirm('グラフをリセットしますか？この操作は取り消せません。')) return;
      this.db.reset();
      clearSaved();
      this.sidebar.hide();
      this.canvas.refreshGraph([], []);
      this.updateStats();
    });

    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToFile(this.db, this.canvas.getPositions());
      showToast('エクスポートしました');
    });

    document.getElementById('import-btn')?.addEventListener('click', () => {
      importFromFile(this.db).then((positions) => {
        if (positions === null) {
          showToast('インポートをキャンセルしました', 'warn');
          return;
        }
        saveGraph(this.db, positions);
        this.sidebar.hide();
        this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges(), positions);
        this.updateStats();
        showToast('インポートしました');
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      saveGraph(this.db, this.canvas.getPositions());
      this.updateStats();
    }, 300);
  }

  private updateStats(): void {
    const nc = document.getElementById('node-count');
    const ec = document.getElementById('edge-count');
    if (nc) nc.textContent = String(this.db.nodeCount());
    if (ec) ec.textContent = String(this.db.edgeCount());
  }

  private refreshAndSave(): void {
    try {
      this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges());
      this.scheduleSave();
    } catch (err) {
      showToast(`グラフの更新に失敗しました: ${String(err)}`);
      console.error('refreshAndSave failed:', err);
    }
  }
}
