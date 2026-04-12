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
 * App が保持する共有リソースへのアクセスを提供するインターフェース。
 * 各コントローラーはこのインターフェースを通じて必要な依存を受け取る。
 */
export interface AppContext {
  readonly db: GraphDB;
  readonly canvas: Canvas;
  readonly sidebar: Sidebar;
  readonly queryPanel: QueryPanel;
  readonly registry: TypeRegistry;
  readonly edgeRegistry: EdgeTypeRegistry;
  readonly undoManager: UndoManager;
  readonly scrapbookStore: ScrapbookStore;

  captureForUndo(): void;
  scheduleSave(): void;
  refreshAndSave(): void;
  getFilteredNodes(): RawNode[];
  getFilteredEdges(): RawEdge[];
  updateNodeTypeFilterOptions(): void;
  updateStats(): void;
  isMobile(): boolean;
  openMobileSidebar(): void;
}
