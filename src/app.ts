import { GraphDB } from './graph/db.js';
import { saveGraph, loadGraph, clearSaved, exportToFile, exportToCypher, importFromFile } from './graph/persistence.js';
import { buildShareUrl, parseShareUrl, restoreSharedGraph } from './graph/urlShare.js';
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
import { showCreateNodeDialog } from './ui/createNodeDialog.js';
import { showCreateEdgeDialog } from './ui/createEdgeDialog.js';
import { showEdgeTypeStyleDialog } from './ui/edgeTypeStyleDialog.js';
import { showNodeTypeStyleDialog } from './ui/nodeTypeStyleDialog.js';
import { showToast } from './ui/toast.js';
import { showCsvImportDialog } from './ui/csvImportDialog.js';
import { importCsv } from './graph/csvImport.js';
import { Marked } from 'marked';
import type { GnId, CanvasEvent, InteractionMode, TabKind, QueryResultCell, SnapshotCell, RawNode, RawEdge } from './types.js';
import { el, clearChildren, afterNextPaint, byId } from './ui/domUtils.js';
import { extractMatchedGnIds, isEdgeValue } from './utils/graphUtils.js';

const syncMarked = new Marked({ async: false });

// ── Tooltip ───────────────────────────────────────────────────────────────────

function buildNodeTooltipContent(node: RawNode): string {
  const label = node._labels[0] ?? '';
  const props = node._properties;
  const name = (props['name'] as string | undefined) ?? '';
  const note = (props['note'] as string | undefined) ?? '';

  const lines: string[] = [];
  if (name) lines.push(`<strong>${escapeHtml(name)}</strong>`);
  if (label) lines.push(`<span class="tooltip-label">:${escapeHtml(label)}</span>`);

  const skipKeys = new Set(['gnId', 'name', 'note']);
  const propEntries = Object.entries(props).filter(([k]) => !skipKeys.has(k));
  if (propEntries.length > 0) {
    lines.push('<div class="tooltip-props">');
    for (const [k, v] of propEntries) {
      lines.push(`<div><span class="tooltip-key">${escapeHtml(k)}:</span> ${escapeHtml(String(v ?? ''))}</div>`);
    }
    lines.push('</div>');
  }

  if (note) {
    const preview = note.length > 200 ? note.slice(0, 200) + '…' : note;
    lines.push(`<div class="tooltip-note tooltip-note-md">${syncMarked.parse(preview) as string}</div>`);
  }

  return lines.join('');
}

function buildEdgeTooltipContent(edge: RawEdge): string {
  const lines: string[] = [];
  lines.push(`<strong>${escapeHtml(edge._type)}</strong>`);

  const skipKeys = new Set(['gnId']);
  const propEntries = Object.entries(edge._properties).filter(([k]) => !skipKeys.has(k));
  if (propEntries.length > 0) {
    lines.push('<div class="tooltip-props">');
    for (const [k, v] of propEntries) {
      lines.push(`<div><span class="tooltip-key">${escapeHtml(k)}:</span> ${escapeHtml(String(v ?? ''))}</div>`);
    }
    lines.push('</div>');
  }

  return lines.join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showTooltip(tooltipEl: HTMLElement, html: string, x: number, y: number): void {
  tooltipEl.innerHTML = html;
  tooltipEl.style.display = 'block';
  tooltipEl.style.left = `${x + 12}px`;
  tooltipEl.style.top = `${y + 12}px`;
  requestAnimationFrame(() => {
    const rect = tooltipEl.getBoundingClientRect();
    if (rect.right > window.innerWidth) tooltipEl.style.left = `${x - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight) tooltipEl.style.top = `${y - rect.height - 8}px`;
  });
}

function hideTooltip(tooltipEl: HTMLElement): void {
  tooltipEl.style.display = 'none';
}

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
  private undoManager = new UndoManager();
  private scrapbookStore!: ScrapbookStore;
  private scrapbook!: Scrapbook;
  private dashboard!: Dashboard;

  private ctxMenu = byId('context-menu');
  private tooltip = byId('hover-tooltip');
  private elAddNodeBtn = byId('add-node-btn');
  private elActionBtns = byId('canvas-action-btns');
  private elTabGraph = byId('tab-graph');
  private elTabScrapbook = byId('tab-scrapbook');
  private elTabDashboard = byId('tab-dashboard');
  private elUndoBtn = byId<HTMLButtonElement>('undo-btn');
  private elRedoBtn = byId<HTMLButtonElement>('redo-btn');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private elSidebarToggleBtn = byId('sidebar-toggle-btn');
  private elSidebarOverlay = byId('sidebar-overlay');
  private elSidebar = byId('sidebar');

  private activeNodeTypeFilter: string | null = null;
  private elNodeTypeFilter = byId<HTMLSelectElement>('node-type-filter');

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

    this.canvas = new Canvas(byId('cy'), (event) => this.handleCanvasEvent(event));

    this.sidebar = new Sidebar();
    this.sidebar.setRegistry(this.registry);
    this.setupSidebarCallbacks();

    this.queryPanel = new QueryPanel();
    this.setupQueryPanel();

    this.scrapbookStore = new ScrapbookStore();
    this.scrapbookStore.load();
    this.scrapbook = new Scrapbook(this.elTabScrapbook, this.scrapbookStore);
    this.dashboard = new Dashboard(this.elTabDashboard);

    this.setupModeControls();
    this.setupToolbarButtons();
    this.setupTabButtons();
    this.setupUndoRedo();
    this.setupMobileSidebar();
    this.setupNodeTypeFilter();

    initResizers(
        () => this.canvas.resize(),
        () => this.canvas.clearHighlight(),
    );

    byId('loading')?.remove();

    afterNextPaint(() => {
      this.canvas.resize();
      this.canvas.initRegistries(this.registry, this.edgeRegistry);
      this.updateNodeTypeFilterOptions();
      this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges(), savedPositions);
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
    const initialTab: TabKind = (hash === 'graph' || hash === 'scrapbook' || hash === 'dashboard') ? hash : 'graph';
    this.switchTab(initialTab);
  }

  private switchTab(tab: TabKind, updateHistory = true): void {
    if (updateHistory) {
      history.replaceState(null, '', `#${tab}`);
    }
    this.elTabGraph.style.display = tab === 'graph' ? 'contents' : 'none';
    this.elTabScrapbook.style.display = tab === 'scrapbook' ? 'flex' : 'none';
    this.elTabDashboard.style.display = tab === 'dashboard' ? 'block' : 'none';
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset['tab'] === tab);
    });
    if (tab === 'graph') {
      requestAnimationFrame(() => this.canvas.resize());
    }
    if (tab === 'dashboard') {
      this.dashboard.refresh(this.db.getAllNodes(), this.db.getAllEdges());
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
      case 'bg-tap':           return this.canvas.clearHighlight();
      case 'delete-selected':  return this.handleDeleteSelected(event.nodeGnIds, event.edgeGnIds);
      case 'node-hovered':     return this.handleNodeHovered(event.gnId, event.x, event.y);
      case 'edge-hovered':     return this.handleEdgeHovered(event.gnId, event.x, event.y);
      case 'element-unhovered': return hideTooltip(this.tooltip);
    }
  }

  private handleNodeHovered(gnId: GnId, x: number, y: number): void {
    const node = this.db.getNodeByGnId(gnId);
    if (!node) return;
    showTooltip(this.tooltip, buildNodeTooltipContent(node), x, y);
  }

  private handleEdgeHovered(gnId: GnId, x: number, y: number): void {
    const edge = this.db.getEdgeByGnId(gnId);
    if (!edge) return;
    showTooltip(this.tooltip, buildEdgeTooltipContent(edge), x, y);
  }

  private handleCanvasClicked(position: { x: number; y: number }): void {
    showCreateNodeDialog(this.registry).then((result) => {
      this.applyMode('edit');
      if (!result) return;
      try {
        this.captureForUndo();
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
    if (node) {
      this.sidebar.showNode(node);
      if (this.isMobile()) this.openMobileSidebar();
    }
    this.highlightConnected(gnId);
  }

  private highlightConnected(gnId: GnId): void {
    try {
      const escaped = gnId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const nodeRows = this.db.execute<Record<string, unknown>>(
        `MATCH (n)-[*0..]-(m) WHERE n.gnId = "${escaped}" RETURN m`
      );
      const edgeRows = this.db.execute<Record<string, unknown>>(
        `MATCH (n)-[r]-(m) WHERE n.gnId = "${escaped}" RETURN r UNION MATCH (n)-[*1..]-()-[r]-() WHERE n.gnId = "${escaped}" RETURN r`
      );
      const { nodeGnIds } = extractMatchedGnIds(nodeRows);
      const { edgeGnIds } = extractMatchedGnIds(edgeRows);
      nodeGnIds.add(gnId);
      this.canvas.highlightByGnId(nodeGnIds, edgeGnIds);
    } catch {
      // ハイライト失敗は無視
    }
  }

  private handleEdgeClicked(gnId: GnId): void {
    const edge = this.db.getEdgeByGnId(gnId);
    if (edge) {
      this.sidebar.showEdge(edge);
      if (this.isMobile()) this.openMobileSidebar();
    }
  }

  private handleEdgeCreated(sourceGnId: GnId, targetGnId: GnId): void {
    showCreateEdgeDialog(this.edgeRegistry).then((type) => {
      this.applyMode('edit');
      if (!type) return;
      try {
        this.captureForUndo();
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
      action: () => this.handleDeleteSelected([gnId], []),
    }], x, y);
  }

  private handleEdgeContext(gnId: GnId, x: number, y: number): void {
    showContextMenu(this.ctxMenu, [{
      label: 'エッジを削除', danger: true,
      action: () => this.handleDeleteSelected([], [gnId]),
    }], x, y);
  }

  private handleDeleteSelected(nodeGnIds: GnId[], edgeGnIds: GnId[]): void {
    this.captureForUndo();
    for (const gnId of edgeGnIds) {
      try { this.db.deleteEdge(gnId); } catch { /* ignore */ }
    }
    for (const gnId of nodeGnIds) {
      try { this.db.deleteNode(gnId); } catch { /* ignore */ }
    }
    this.sidebar.hide();
    this.refreshAndSave();
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
              this.captureForUndo();
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
      this.captureForUndo();
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
        this.captureForUndo();
        this.db.updateNodeProperty(gnId, key, value);
        this.scheduleSave();
      } catch (err) {
        showToast(String(err), 'warn');
      }
    });

    this.sidebar.onAddProperty((gnId, key, value) => {
      try {
        this.captureForUndo();
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
      this.captureForUndo();
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
      showNodeTypeStyleDialog(this.registry).then(() => {
        this.canvas.updateNodeStyles(this.registry);
        this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges());
      });
    });

    byId('edge-types-btn')?.addEventListener('click', () => {
      showEdgeTypeStyleDialog(this.edgeRegistry).then(() => {
        this.canvas.updateEdgeStyles(this.edgeRegistry);
      });
    });

    byId('reset-btn')?.addEventListener('click', () => {
      if (!window.confirm('グラフをリセットしますか？')) return;
      this.captureForUndo();
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

    byId('share-btn')?.addEventListener('click', () => {
      buildShareUrl(this.db, this.canvas.getPositions(), this.canvas.getViewport())
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
      const snapshotBeforeImport = UndoManager.captureSnapshot(this.db, this.canvas.getPositions());
      importFromFile(this.db).then((result) => {
        if (result === null) {
          showToast('インポートをキャンセルしました', 'warn');
          return;
        }
        this.undoManager.pushState(snapshotBeforeImport);
        saveGraph(this.db, result.positions);
        this.sidebar.hide();
        this.canvas.refreshGraph(this.db.getAllNodes(), this.db.getAllEdges(), result.positions);
        this.updateStats();
        showToast('インポートしました', 'success');
      });
    });

    byId('import-csv-btn')?.addEventListener('click', () => {
      showCsvImportDialog(this.registry).then((result) => {
        if (!result) {
          showToast('CSVインポートをキャンセルしました', 'warn');
          return;
        }
        try {
          this.captureForUndo();
          const { nodeCount, edgeCount, skippedEdges } = importCsv(this.db, result.csvText, result.options);
          for (const edge of this.db.getAllEdges()) {
            this.edgeRegistry.ensure(edge._type);
          }
          this.registry.ensure(result.options.nodeLabel);
          this.refreshAndSave();
          const msg = `CSVインポート完了: ノード ${nodeCount} 件、エッジ ${edgeCount} 件` +
            (skippedEdges > 0 ? `（スキップ ${skippedEdges} 件）` : '');
          showToast(msg, 'success');
        } catch (err) {
          showToast(`CSVインポートに失敗しました: ${String(err)}`, 'warn');
        }
      });
    });
  }

  // ── Query helpers ─────────────────────────────────────────────────────────────

  /**
   * rowsにエッジが含まれない場合、rowsに含まれるノード間のエッジをDBから取得して補完する。
   * これにより保存後のScrapbookでもエッジが表示される。
   */
  private enrichRowsWithEdges(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const hasEdge = rows.some(row => Object.values(row).some(isEdgeValue));
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

  // ── Undo / Redo ──────────────────────────────────────────────────────────────

  private captureForUndo(): void {
    const snapshot = UndoManager.captureSnapshot(this.db, this.canvas.getPositions());
    this.undoManager.pushState(snapshot);
  }

  private performUndo(): void {
    if (!this.undoManager.canUndo()) return;
    const current = UndoManager.captureSnapshot(this.db, this.canvas.getPositions());
    const prev = this.undoManager.undo(current);
    if (!prev) return;
    const positions = UndoManager.restoreSnapshot(this.db, prev);
    this.sidebar.hide();
    this.updateNodeTypeFilterOptions();
    this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges(), positions);
    this.scheduleSave();
  }

  private performRedo(): void {
    if (!this.undoManager.canRedo()) return;
    const current = UndoManager.captureSnapshot(this.db, this.canvas.getPositions());
    const next = this.undoManager.redo(current);
    if (!next) return;
    const positions = UndoManager.restoreSnapshot(this.db, next);
    this.sidebar.hide();
    this.updateNodeTypeFilterOptions();
    this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges(), positions);
    this.scheduleSave();
  }

  private updateUndoRedoButtons(): void {
    this.elUndoBtn.disabled = !this.undoManager.canUndo();
    this.elRedoBtn.disabled = !this.undoManager.canRedo();
  }

  private setupUndoRedo(): void {
    this.undoManager.onChange(() => this.updateUndoRedoButtons());

    this.elUndoBtn.addEventListener('click', () => this.performUndo());
    this.elRedoBtn.addEventListener('click', () => this.performRedo());

    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // Ctrl+Z → undo
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.performUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y → redo
      if ((e.key === 'Z' && e.shiftKey) || (e.key === 'y' && !e.shiftKey)) {
        e.preventDefault();
        this.performRedo();
      }
    });
  }

  // ── Mobile sidebar ──────────────────────────────────────────────────────────

  private isMobile(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  private openMobileSidebar(): void {
    this.elSidebar.classList.add('mobile-open');
    this.elSidebarOverlay.classList.add('active');
    this.elSidebarToggleBtn.classList.add('active');
  }

  private closeMobileSidebar(): void {
    this.elSidebar.classList.remove('mobile-open');
    this.elSidebarOverlay.classList.remove('active');
    this.elSidebarToggleBtn.classList.remove('active');
  }

  private setupMobileSidebar(): void {
    this.elSidebarToggleBtn.addEventListener('click', () => {
      if (this.elSidebar.classList.contains('mobile-open')) {
        this.closeMobileSidebar();
      } else {
        this.openMobileSidebar();
      }
    });

    this.elSidebarOverlay.addEventListener('click', () => {
      this.closeMobileSidebar();
    });
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

  private getFilteredNodes(): RawNode[] {
    const nodes = this.db.getAllNodes();
    if (!this.activeNodeTypeFilter) return nodes;
    return nodes.filter((n) => n._labels.includes(this.activeNodeTypeFilter!));
  }

  private getFilteredEdges(): RawEdge[] {
    if (!this.activeNodeTypeFilter) return this.db.getAllEdges();
    const filteredNodes = this.getFilteredNodes();
    const internalIds = new Set(filteredNodes.map((n) => n._id));
    return this.db.getAllEdges().filter((e) => internalIds.has(e._src) && internalIds.has(e._dst));
  }

  private updateNodeTypeFilterOptions(): void {
    const current = this.elNodeTypeFilter.value;
    const types = this.registry.getAll().sort();
    while (this.elNodeTypeFilter.options.length > 1) {
      this.elNodeTypeFilter.remove(1);
    }
    for (const t of types) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      this.elNodeTypeFilter.appendChild(opt);
    }
    if (types.includes(current)) {
      this.elNodeTypeFilter.value = current;
    } else {
      this.elNodeTypeFilter.value = '';
      this.activeNodeTypeFilter = null;
    }
  }

  private setupNodeTypeFilter(): void {
    this.elNodeTypeFilter.addEventListener('change', () => {
      this.activeNodeTypeFilter = this.elNodeTypeFilter.value || null;
      this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges());
    });
  }

  private refreshAndSave(): void {
    try {
      this.canvas.updateEdgeStyles(this.edgeRegistry);
      this.updateNodeTypeFilterOptions();
      this.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges());
      this.scheduleSave();
    } catch (err) {
      showToast(`グラフの更新に失敗しました: ${String(err)}`);
      console.error('refreshAndSave failed:', err);
    }
  }
}
