import { GraphDB } from './graph/db.js';
import { saveGraph, loadGraph } from './graph/persistence.js';
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

  private scrapbook!: Scrapbook;
  private dashboard!: Dashboard;
  private mobileSidebar!: MobileSidebarController;
  private nodeTypeFilter!: NodeTypeFilterController;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    this.db = new GraphDB();
    await this.db.init();

    this.registry = new TypeRegistry();
    this.edgeRegistry = new EdgeTypeRegistry();

    // Check for shared graph in URL before falling back to localStorage
    let savedPositions: Record<GnId, { x: number; y: number }>;
    let savedViewport: { pan: { x: number; y: number }; zoom: number } | undefined;
    const sharedGraph = await parseShareUrl();
    if (sharedGraph) {
      const result = restoreSharedGraph(this.db, sharedGraph);
      savedPositions = result.positions;
      savedViewport = result.viewport;
      // Clear the share hash so it doesn't reload on refresh
      history.replaceState(null, '', location.pathname);
      // Persist the shared graph to localStorage
      saveGraph(this.db, savedPositions, savedViewport);
      showToast('共有されたグラフを読み込みました', 'success');
    } else {
      const result = await loadGraph(this.db);
      savedPositions = result.positions;
      savedViewport = result.viewport;
    }
    for (const edge of this.db.getAllEdges()) {
      this.edgeRegistry.ensure(edge._type);
    }

    // Canvas (event handling delegated to CanvasEventController)
    const canvasCtrl = new CanvasEventController(this);
    this.canvas = new Canvas(byId('cy'), (event) => canvasCtrl.handleCanvasEvent(event));

    this.sidebar = new Sidebar();
    this.sidebar.setRegistry(this.registry);

    this.queryPanel = new QueryPanel();

    this.scrapbookStore = new ScrapbookStore();
    this.scrapbookStore.load();
    const elTabScrapbook = byId('tab-scrapbook');
    const elTabDashboard = byId('tab-dashboard');
    this.scrapbook = new Scrapbook(elTabScrapbook, this.scrapbookStore);
    this.dashboard = new Dashboard(elTabDashboard);

    // Mobile sidebar controller
    this.mobileSidebar = new MobileSidebarController();
    this.mobileSidebar.setup();

    // Node type filter controller
    this.nodeTypeFilter = new NodeTypeFilterController(this);
    this.nodeTypeFilter.setup();

    // Setup all controllers
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

    byId('loading')?.remove();

    afterNextPaint(() => {
      this.canvas.resize();
      this.canvas.initRegistries(this.registry, this.edgeRegistry);
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

  // ── AppContext implementation ────────────────────────────────────────────────

  captureForUndo(): void {
    const snapshot = UndoManager.captureSnapshot(this.db, this.canvas.getPositions());
    this.undoManager.pushState(snapshot);
  }

  scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      saveGraph(this.db, this.canvas.getPositions(), this.canvas.getViewport());
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

  isMobile(): boolean {
    return this.mobileSidebar.isMobile();
  }

  openMobileSidebar(): void {
    this.mobileSidebar.open();
  }
}
