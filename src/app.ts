import { GraphDB } from './graph/db.js';
import { saveGraph, loadGraph, clearSaved, exportToFile, exportToCypher, importFromFile } from './graph/persistence.js';
import { TypeRegistry } from './graph/typeRegistry.js';
import { EdgeTypeRegistry } from './graph/edgeTypeRegistry.js';
import { Canvas } from './ui/canvas.js';
import { Sidebar } from './ui/sidebar.js';
import { QueryPanel } from './ui/queryPanel.js';
import { Scrapbook } from './ui/scrapbook.js';
import { ScrapbookStore } from './notebook/scrapbookStore.js';
import { initResizers } from './ui/resizer.js';
import { showCreateNodeDialog } from './ui/createNodeDialog.js';
import { showTypeManagerDialog } from './ui/typeManagerDialog.js';
import { showCreateEdgeDialog } from './ui/createEdgeDialog.js';
import { showToast } from './ui/toast.js';
import type { GnId, CanvasEvent, InteractionMode, TabKind, QueryResultCell, SnapshotCell } from './types.js';
import { el, clearChildren, afterNextPaint, byId } from './ui/domUtils.js';
import { extractMatchedGnIds } from './utils/graphUtils.js';

// ── Context Menu ──────────────────────────────────────────────────────────────

type MenuItem = { label: string; danger?: boolean; action: () => void };

function showContextMenu(ctxMenu: HTMLElement, items: MenuItem[], x: number, y: number): void {
  clearChildren(ctxMenu);
  for (const item of items) {
    const btn = el('button', { class: item.danger ? 'ctx-item danger' : 'ctx-item' }, item.label);
    btn.addEventListener('click', () => {
      item.action();
      hideContextMenu(ctxMenu);
    });
    ctxMenu.appendChild(btn);
  }

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
  private edgeRegistry!: EdgeTypeRegistry;
  private scrapbookStore!: ScrapbookStore;
  private scrapbook!: Scrapbook;

  private ctxMenu = byId('context-menu');
  private elAddNodeBtn = byId('add-node-btn');
  private elActionBtns = byId('canvas-action-btns');
  private elTabGraph = byId('tab-graph');
  private elTabScrapbook = byId('tab-scrapbook');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    this.db = new GraphDB();
    await this.db.init();

    this.registry = new TypeRegistry();
    this.edgeRegistry = new EdgeTypeRegistry();
    const {positions: savedPositions, viewport: savedViewport} = await loadGraph(this.db);
    for (const edge of this.db.getAllEdges()) {
      this.edgeRegistry.ensure(edge._type);
    }

    this.canvas = new Canvas(byId('cy'), (event) => this.handleCanvasEvent(event));

    this.sidebar = new Sidebar();
    this.sidebar.setRegistry(this.registry);
    this.setupSidebarCallbacks();

    this.queryPanel = new QueryPanel();
    this.setupQueryPanel();

    this.scrapbookStore = new ScrapbookStore();
    this.scrapbookStore.load();
    this.scrapbook = new Scrapbook(this.elTabScrapbook, this.scrapbookStore);

    this.setupModeControls();
    this.setupToolbarButtons();
    this.setupTabButtons();

    initResizers(
        () => this.canvas.resize(),
        () => this.canvas.clearHighlight(),
    );

    byId('loading')?.remove();

    afterNextPaint(() => {
      this.canvas.resize();
      this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges(), savedPositions);
      if (savedViewport) {
        this.canvas.setViewport(savedViewport.pan, savedViewport.zoom);
      } else if (this.db.getAllNodes().length > 0) {
        this.canvas.fitView();
      }
      this.updateStats();
    });
  }

  // ── Tab switching ─────────────────────────────────────────────────────────────

  private setupTabButtons(): void {
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset['tab'] as TabKind;
        if (tab) this.switchTab(tab);
      });
    });
    const hash = location.hash.replace('#', '') as TabKind;
    const initialTab: TabKind = (hash === 'graph' || hash === 'scrapbook') ? hash : 'graph';
    this.switchTab(initialTab);
  }

  private switchTab(tab: TabKind, updateHistory = true): void {
    if (updateHistory) {
      history.replaceState(null, '', `#${tab}`);
    }
    this.elTabGraph.style.display = tab === 'graph' ? 'contents' : 'none';
    this.elTabScrapbook.style.display = tab === 'scrapbook' ? 'flex' : 'none';
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset['tab'] === tab);
    });
    if (tab === 'graph') {
      requestAnimationFrame(() => this.canvas.resize());
    }
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
      try {
        this.registry.ensure(result.type);
        const gnId = this.db.createNode(result.type, { name: result.name });
        this.canvas.hintPosition(gnId, position);
        this.refreshAndSave();
      } catch (err) {
        showToast(`ノードの作成に失敗しました: ${String(err)}`, 'warn');
      }
    });
  }

  private handleNodeClicked(gnId: GnId): void {
    const node = this.db.getNodeByGnId(gnId);
    if (node) this.sidebar.showNode(node);
  }

  private handleEdgeClicked(gnId: GnId): void {
    const edge = this.db.getEdgeByGnId(gnId);
    if (edge) this.sidebar.showEdge(edge);
  }

  private handleEdgeCreated(sourceGnId: GnId, targetGnId: GnId): void {
    showCreateEdgeDialog(this.edgeRegistry).then((type) => {
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

  private handleNodeContext(gnId: GnId, x: number, y: number): void {
    showContextMenu(this.ctxMenu, [{
      label: 'ノードを削除', danger: true,
      action: () => {
        this.db.deleteNode(gnId);
        this.sidebar.hide();
        this.refreshAndSave();
      },
    }], x, y);
  }

  private handleEdgeContext(gnId: GnId, x: number, y: number): void {
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
    const canvasPos = this.canvas.clientToCanvasPosition(x, y);
    showContextMenu(this.ctxMenu, [
      {
        label: 'ノードを作成',
        action: () => {
          showCreateNodeDialog(this.registry).then((result) => {
            if (!result) return;
            try {
              this.registry.ensure(result.type);
              const gnId = this.db.createNode(result.type, { name: result.name });
              this.canvas.hintPosition(gnId, canvasPos);
              this.refreshAndSave();
            } catch (err) {
              showToast(`ノードの作成に失敗しました: ${String(err)}`, 'warn');
            }
          });
        },
      },
      {
        label: 'Scrapbook にスナップショットを送る',
        action: () => this.sendSnapshotToScrapbook(),
      },
    ], x, y);
  }

  private sendSnapshotToScrapbook(): void {
    const label = `Snapshot ${new Date().toLocaleString('ja-JP')}`;
    const positions = this.canvas.getPositions();
    const pngDataUrl = this.canvas.png();
    const cell: SnapshotCell = {
      id: crypto.randomUUID(),
      kind: 'snapshot',
      createdAt: Date.now(),
      label,
      positions,
      pngDataUrl,
    };
    this.scrapbookStore.addCell(cell);
    showToast('Scrapbook にスナップショットを送りました', 'success');
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
      try {
        this.db.updateNodeProperty(gnId, key, value);
        this.scheduleSave();
      } catch (err) {
        showToast(String(err), 'warn');
      }
    });

    this.sidebar.onAddProperty((gnId, key, value) => {
      try {
        this.db.updateNodeProperty(gnId, key, value);
        const node = this.db.getNodeByGnId(gnId);
        if (node) this.sidebar.showNode(node);
        this.scheduleSave();
      } catch (err) {
        showToast(String(err), 'warn');
      }
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

        const cell: QueryResultCell = {
          id: crypto.randomUUID(),
          kind: 'query-result',
          createdAt: Date.now(),
          query,
          rows: this.enrichRowsWithEdges(rows as Record<string, unknown>[]),
          elapsedMs: elapsed,
        };
        this.scrapbookStore.addCell(cell);
      } catch (err) {
        this.queryPanel.showError(String(err));
        showToast(String(err), 'warn');
      }
    });
  }

  // ── Mode controls ─────────────────────────────────────────────────────────────

  private applyMode(mode: InteractionMode): void {
    this.canvas.setMode(mode);
    this.elAddNodeBtn.classList.toggle('active', mode === 'node');
    this.elActionBtns.style.display = 'flex';
  }

  private setupModeControls(): void {
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
    byId('fit-btn')?.addEventListener('click', () => this.canvas.fitView());

    byId('types-btn')?.addEventListener('click', () => {
      showTypeManagerDialog(this.registry);
    });

    byId('reset-btn')?.addEventListener('click', () => {
      if (!window.confirm('グラフをリセットしますか？この操作は取り消せません。')) return;
      this.db.reset();
      clearSaved();
      this.sidebar.hide();
      this.canvas.refreshGraph([], []);
      this.updateStats();
    });

    byId('export-json-btn')?.addEventListener('click', () => {
      exportToFile(this.db, this.canvas.getPositions());
      showToast('JSON形式でエクスポートしました', 'success');
    });

    byId('export-cypher-btn')?.addEventListener('click', () => {
      exportToCypher(this.db, this.canvas.getPositions());
      showToast('Cypher形式でエクスポートしました', 'success');
    });

    byId('import-btn')?.addEventListener('click', () => {
      importFromFile(this.db).then((result) => {
        if (result === null) {
          showToast('インポートをキャンセルしました', 'warn');
          return;
        }
        saveGraph(this.db, result.positions);
        this.sidebar.hide();
        this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges(), result.positions);
        this.updateStats();
        showToast('インポートしました', 'success');
      });
    });
  }

  // ── Query helpers ─────────────────────────────────────────────────────────────

  /**
   * rowsにエッジが含まれない場合、rowsに含まれるノード間のエッジをDBから取得して補完する。
   * これにより保存後のScrapbookでもエッジが表示される。
   */
  private enrichRowsWithEdges(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const hasEdge = rows.some(row =>
      Object.values(row).some(val => {
        if (val === null || typeof val !== 'object' || Array.isArray(val)) return false;
        const obj = val as Record<string, unknown>;
        return typeof obj['_type'] === 'string' && typeof obj['_src'] === 'string' && typeof obj['_dst'] === 'string';
      })
    );
    if (hasEdge) return rows;

    // ノードのgnIdを収集
    const gnIds: string[] = [];
    for (const row of rows) {
      for (const val of Object.values(row)) {
        if (val === null || typeof val !== 'object' || Array.isArray(val)) continue;
        const obj = val as Record<string, unknown>;
        if (Array.isArray(obj['_labels']) && typeof obj['_properties'] === 'object' && obj['_properties'] !== null) {
          const props = obj['_properties'] as Record<string, unknown>;
          if (typeof props['gnId'] === 'string') gnIds.push(props['gnId']);
        }
      }
    }
    if (gnIds.length === 0) return rows;

    try {
      const list = gnIds.map(id => `"${id}"`).join(', ');
      const edgeRows = this.db.execute<Record<string, unknown>>(
        `MATCH (a)-[r]->(b) WHERE a.gnId IN [${list}] AND b.gnId IN [${list}] RETURN r`
      );
      if (edgeRows.length === 0) return rows;
      return [...rows, ...edgeRows];
    } catch {
      return rows;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      saveGraph(this.db, this.canvas.getPositions(), this.canvas.getViewport());
      this.updateStats();
    }, 300);
  }

  private updateStats(): void {
    const nc = byId('node-count');
    const ec = byId('edge-count');
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
