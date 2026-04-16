import { GraphDB } from './graph/db.js';
import { migrateFromLocalStorage } from './graph/persistence.js';
import { GraphManager } from './graph/graphManager.js';
import { GraphSwitcher } from './ui/graphSwitcher.js';
import { parseShareUrl, restoreSharedGraph } from './graph/urlShare.js';
import { TypeRegistry } from './graph/typeRegistry.js';
import { EdgeTypeRegistry } from './graph/edgeTypeRegistry.js';
import { UndoManager } from './graph/undoManager.js';
import { Canvas } from './ui/canvas.js';
import { Sidebar } from './ui/sidebar.js';
import { QueryPanel } from './ui/queryPanel.js';
import { Scrapbook } from './ui/scrapbook.js';
import { Dashboard } from './ui/dashboard.js';
import { ScrapbookStore } from './notebook/scrapbookStore.js';
import { BookmarkStore } from './graph/bookmarkStore.js';
import { initResizers } from './ui/resizer.js';
import { showToast } from './ui/toast.js';
import { byId, afterNextPaint } from './ui/domUtils.js';
import type { AppContext } from './appContext.js';
import type { GnId, RawNode, RawEdge } from './types.js';

import { CanvasEventController } from './controllers/canvasEventController.js';
import { setupSidebarCallbacks } from './controllers/sidebarController.js';
import { setupQueryPanel, refreshCompletionContext } from './controllers/queryPanelController.js';
import { setupModeControls, setupToolbarButtons } from './controllers/toolbarController.js';
import { setupUndoRedo } from './controllers/undoRedoController.js';
import { MobileSidebarController } from './controllers/mobileSidebarController.js';
import { NodeTypeFilterController } from './controllers/nodeTypeFilterController.js';
import { setupTabButtons } from './controllers/tabController.js';

// ── App ───────────────────────────────────────────────────────────────────────

export class App implements AppContext {
  db!: GraphDB;
  canvas!: Canvas;
  sidebar!: Sidebar;
  queryPanel!: QueryPanel;
  registry!: TypeRegistry;
  edgeRegistry!: EdgeTypeRegistry;
  undoManager = new UndoManager();
  scrapbookStore!: ScrapbookStore;
  bookmarkStore!: BookmarkStore;

  private scrapbook!: Scrapbook;
  private dashboard!: Dashboard;
  private mobileSidebar!: MobileSidebarController;
  private nodeTypeFilter!: NodeTypeFilterController;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private graphManager!: GraphManager;
  private graphSwitcher!: GraphSwitcher;

  async init(): Promise<void> {
    const { savedPositions, savedViewport } = await this.initData();
    this.initUI();
    this.setupControllers();
    this.initGraphSwitcher();

    document.getElementById('loading')?.remove();

    afterNextPaint(() => {
      this.canvas.resize();
      this.nodeTypeFilter.updateOptions();
      this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges(), savedPositions);
      if (savedViewport) {
        this.canvas.setViewport(savedViewport.pan, savedViewport.zoom);
      } else if (this.db.getAllNodes().length > 0) {
        this.canvas.fitView();
      }
      this.updateStats();
    });
  }

  async initData(): Promise<{
    savedPositions: Record<GnId, { x: number; y: number }>;
    savedViewport: { pan: { x: number; y: number }; zoom: number } | undefined;
  }> {
    this.db = new GraphDB();
    await this.db.init();

    this.registry = new TypeRegistry();
    this.edgeRegistry = new EdgeTypeRegistry();

    // Migrate existing localStorage data to IndexedDB
    await migrateFromLocalStorage();

    // Initialize graph manager (handles legacy data migration)
    this.graphManager = new GraphManager();
    await this.graphManager.init();

    // Check for shared graph in URL before falling back to IndexedDB
    let savedPositions: Record<GnId, { x: number; y: number }>;
    let savedViewport: { pan: { x: number; y: number }; zoom: number } | undefined;
    const sharedGraph = await parseShareUrl();
    if (sharedGraph) {
      // 新しいグラフとしてインポートする（既存グラフを上書きしない）
      const importedMeta = await this.graphManager.createGraph('共有グラフ');
      await this.graphManager.switchGraph(importedMeta.id, this.db);
      const result = restoreSharedGraph(this.db, sharedGraph);
      savedPositions = result.positions;
      savedViewport = result.viewport;
      // Clear the share hash so it doesn't reload on refresh
      history.replaceState(null, '', location.pathname);
      // Persist the shared graph to IndexedDB
      await this.graphManager.saveCurrentGraph(this.db, savedPositions, savedViewport);
      showToast('共有されたグラフをインポートしました', 'success');
    } else {
      const result = await this.graphManager.switchGraph(this.graphManager.currentGraphId, this.db);
      savedPositions = result.positions;
      savedViewport = result.viewport;
    }
    for (const edge of this.db.getAllEdges()) {
      this.edgeRegistry.ensure(edge._type);
    }

    return { savedPositions, savedViewport };
  }

  private initUI(): void {
    // Canvas (event handling delegated to CanvasEventController)
    const canvasCtrl = new CanvasEventController(this);
    this.canvas = new Canvas(byId('cy'), (event) => canvasCtrl.handleCanvasEvent(event), this.registry, this.edgeRegistry);

    this.sidebar = new Sidebar();
    this.sidebar.setRegistry(this.registry);

    this.queryPanel = new QueryPanel();

    this.scrapbookStore = new ScrapbookStore();
    this.scrapbookStore.load();
    this.bookmarkStore = new BookmarkStore();
    const elTabScrapbook = byId('tab-scrapbook');
    const elTabDashboard = byId('tab-dashboard');
    this.scrapbook = new Scrapbook(elTabScrapbook, this.scrapbookStore);
    this.dashboard = new Dashboard(elTabDashboard);
  }

  private setupControllers(): void {
    // Mobile sidebar controller
    this.mobileSidebar = new MobileSidebarController();
    this.mobileSidebar.setup();

    // Node type filter controller
    this.nodeTypeFilter = new NodeTypeFilterController(this);
    this.nodeTypeFilter.setup();

    setupSidebarCallbacks(this);
    setupQueryPanel(this);
    setupModeControls(this);
    setupToolbarButtons(this);
    setupTabButtons(this.canvas, this.db, this.dashboard);
    setupUndoRedo(this);

    initResizers(
        () => this.canvas.resize(),
        () => this.canvas.clearHighlight(),
    );
  }

  // ── AppContext implementation ────────────────────────────────────────────────

  captureForUndo(): void {
    const snapshot = UndoManager.captureSnapshot(this.db, this.canvas.getPositions());
    this.undoManager.pushState(snapshot);
  }

  scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.graphManager.saveCurrentGraph(this.db, this.canvas.getPositions(), this.canvas.getViewport()).catch((err) => console.warn('Failed to save graph:', err));
      this.updateStats();
    }, 300);
  }

  refreshAndSave(): void {
    try {
      this.canvas.updateEdgeStyles(this.edgeRegistry);
      this.nodeTypeFilter.updateOptions();
      this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges());
      refreshCompletionContext(this);
      this.scheduleSave();
    } catch (err) {
      showToast(`グラフの更新に失敗しました: ${String(err)}`);
      console.error('refreshAndSave failed:', err);
    }
  }

  getFilteredNodes(): RawNode[] {
    return this.nodeTypeFilter.getFilteredNodes();
  }

  getFilteredEdges(): RawEdge[] {
    return this.nodeTypeFilter.getFilteredEdges();
  }

  updateNodeTypeFilterOptions(): void {
    this.nodeTypeFilter.updateOptions();
  }

  updateStats(): void {
    const nc = byId('node-count');
    const ec = byId('edge-count');
    if (nc) nc.textContent = String(this.db.nodeCount());
    if (ec) ec.textContent = String(this.db.edgeCount());
  }

  private initGraphSwitcher(): void {
    this.graphSwitcher = new GraphSwitcher(this.graphManager, async (id: string) => {
      // Save current graph before switching
      await this.graphManager.saveCurrentGraph(this.db, this.canvas.getPositions(), this.canvas.getViewport());
      // Reset state
      this.undoManager.clear();
      this.db.reset();
      // Load new graph
      const result = await this.graphManager.switchGraph(id, this.db);
      for (const edge of this.db.getAllEdges()) {
        this.edgeRegistry.ensure(edge._type);
      }
      this.canvas.updateEdgeStyles(this.edgeRegistry);
      this.nodeTypeFilter.updateOptions();
      this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges(), result.positions);
      if (result.viewport) {
        this.canvas.setViewport(result.viewport.pan, result.viewport.zoom);
      } else {
        this.canvas.fitView();
      }
      this.updateStats();
      refreshCompletionContext(this);
    });
  }

  isMobile(): boolean {
    return this.mobileSidebar.isMobile();
  }

  openMobileSidebar(): void {
    this.mobileSidebar.open();
  }
}
