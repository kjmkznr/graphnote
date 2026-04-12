import type { GraphDB } from './graph/db.js';
import type { TypeRegistry } from './graph/typeRegistry.js';
import type { EdgeTypeRegistry } from './graph/edgeTypeRegistry.js';
import type { UndoManager } from './graph/undoManager.js';
import type { Canvas } from './ui/canvas.js';
import type { Sidebar } from './ui/sidebar.js';
import type { QueryPanel } from './ui/queryPanel.js';
import type { ScrapbookStore } from './notebook/scrapbookStore.js';
import type { RawNode, RawEdge } from './types.js';

/**
 * サイドバーコントローラーが必要とする依存のサブセット。
 */
export interface SidebarContext {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  captureForUndo(): void;
  scheduleSave(): void;
}

/**
 * クエリパネルコントローラーが必要とする依存のサブセット。
 */
export interface QueryPanelContext {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly queryPanel: QueryPanel;
  readonly registry: TypeRegistry;
  readonly edgeRegistry: EdgeTypeRegistry;
  readonly scrapbookStore: ScrapbookStore;
  captureForUndo(): void;
  scheduleSave(): void;
}

/**
 * アンドゥ／リドゥコントローラーが必要とする依存のサブセット。
 */
export interface UndoContext {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  readonly undoManager: UndoManager;
  getFilteredNodes(): RawNode[];
  getFilteredEdges(): RawEdge[];
  updateNodeTypeFilterOptions(): void;
  scheduleSave(): void;
}

/**
 * ツールバーコントローラーが必要とする依存のサブセット。
 */
export interface ToolbarContext {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  readonly registry: TypeRegistry;
  readonly edgeRegistry: EdgeTypeRegistry;
  readonly undoManager: UndoManager;
  readonly scrapbookStore: ScrapbookStore;
  captureForUndo(): void;
  refreshAndSave(): void;
  updateStats(): void;
}

/**
 * ノードタイプフィルターコントローラーが必要とする依存のサブセット。
 */
export interface NodeTypeFilterContext {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly registry: TypeRegistry;
}

/**
 * キャンバスイベントコントローラーが必要とする依存のサブセット。
 */
export interface CanvasEventContext {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  readonly registry: TypeRegistry;
  readonly edgeRegistry: EdgeTypeRegistry;
  readonly scrapbookStore: ScrapbookStore;
  captureForUndo(): void;
  refreshAndSave(): void;
  isMobile(): boolean;
  openMobileSidebar(): void;
}

/**
 * App が保持する共有リソースへのアクセスを提供するインターフェース。
 * 各コントローラーはこのインターフェースを通じて必要な依存を受け取る。
 * コントローラー毎のサブインターフェース（SidebarContext, QueryPanelContext 等）も参照のこと。
 */
export interface AppContext extends
  SidebarContext,
  QueryPanelContext,
  UndoContext,
  ToolbarContext,
  NodeTypeFilterContext,
  CanvasEventContext {
}
