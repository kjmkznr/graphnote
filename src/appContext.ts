import type { GraphDB } from "./graph/db.js";
import type { TypeRegistry } from "./graph/typeRegistry.js";
import type { EdgeTypeRegistry } from "./graph/edgeTypeRegistry.js";
import type { UndoManager } from "./graph/undoManager.js";
import type { Canvas } from "./ui/canvas.js";
import type { Sidebar } from "./ui/sidebar.js";
import type { QueryPanel } from "./ui/queryPanel.js";
import type { ScrapbookStore } from "./notebook/scrapbookStore.js";
import type { BookmarkStore } from "./graph/bookmarkStore.js";
import type { RawNode, RawEdge } from "./types.js";

/**
 * 複数のコンテキストインターフェースで共通して使用される操作メソッド。
 */
export interface AppOperations {
  captureForUndo(): void;
  scheduleSave(): void;
  refreshAndSave(): void;
}

/**
 * サイドバーコントローラーが必要とする依存のサブセット。
 */
export interface SidebarContext extends Pick<
  AppOperations,
  "captureForUndo" | "scheduleSave"
> {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
}

/**
 * クエリパネルコントローラーが必要とする依存のサブセット。
 */
export interface QueryPanelContext extends Pick<
  AppOperations,
  "captureForUndo" | "scheduleSave"
> {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly queryPanel: QueryPanel;
  readonly registry: TypeRegistry;
  readonly edgeRegistry: EdgeTypeRegistry;
  readonly scrapbookStore: ScrapbookStore;
  readonly bookmarkStore: BookmarkStore;
}

/**
 * アンドゥ／リドゥコントローラーが必要とする依存のサブセット。
 */
export interface UndoContext extends Pick<AppOperations, "scheduleSave"> {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  readonly undoManager: UndoManager;
  getFilteredNodes(): RawNode[];
  getFilteredEdges(): RawEdge[];
  updateNodeTypeFilterOptions(): void;
}

/**
 * ツールバーコントローラーが必要とする依存のサブセット。
 */
export interface ToolbarContext extends Pick<
  AppOperations,
  "captureForUndo" | "refreshAndSave"
> {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  readonly registry: TypeRegistry;
  readonly edgeRegistry: EdgeTypeRegistry;
  readonly undoManager: UndoManager;
  readonly scrapbookStore: ScrapbookStore;
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
export interface CanvasEventContext extends Pick<
  AppOperations,
  "captureForUndo" | "refreshAndSave"
> {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  readonly registry: TypeRegistry;
  readonly edgeRegistry: EdgeTypeRegistry;
  readonly scrapbookStore: ScrapbookStore;
  isMobile(): boolean;
  openMobileSidebar(): void;
}

/**
 * App が保持する共有リソースへのアクセスを提供するインターフェース。
 * 各コントローラーはこのインターフェースを通じて必要な依存を受け取る。
 * コントローラー毎のサブインターフェース（SidebarContext, QueryPanelContext 等）も参照のこと。
 */
export interface AppContext
  extends
    SidebarContext,
    QueryPanelContext,
    UndoContext,
    ToolbarContext,
    NodeTypeFilterContext,
    CanvasEventContext {}
