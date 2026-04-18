/**
 * Canonical DOM element ID constants.
 * All getElementById / byId calls must reference these instead of inline strings,
 * so that renaming an ID in index.html produces a compile-time error.
 */
export const DOM_IDS = {
  // ── Loading ──────────────────────────────────────────────────────────────
  loading: 'loading',

  // ── Root ─────────────────────────────────────────────────────────────────
  app: 'app',

  // ── Graph Switcher ────────────────────────────────────────────────────────
  graphSwitcher: 'graph-switcher',
  graphSelect: 'graph-select',
  graphNewBtn: 'graph-new-btn',
  graphRenameBtn: 'graph-rename-btn',
  graphDeleteBtn: 'graph-delete-btn',

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  undoBtn: 'undo-btn',
  redoBtn: 'redo-btn',

  // ── Header stats & toolbar buttons ────────────────────────────────────────
  nodeCount: 'node-count',
  edgeCount: 'edge-count',
  typesBtn: 'types-btn',
  edgeTypesBtn: 'edge-types-btn',
  exportJsonBtn: 'export-json-btn',
  exportCypherBtn: 'export-cypher-btn',
  importJsonBtn: 'import-json-btn',
  importCsvBtn: 'import-csv-btn',
  shareBtn: 'share-btn',
  resetBtn: 'reset-btn',

  // ── Tab panels ────────────────────────────────────────────────────────────
  tabGraph: 'tab-graph',
  tabScrapbook: 'tab-scrapbook',
  tabDashboard: 'tab-dashboard',

  // ── Canvas ────────────────────────────────────────────────────────────────
  cy: 'cy',
  canvasActionBtns: 'canvas-action-btns',
  addNodeBtn: 'add-node-btn',
  fitBtn: 'fit-btn',
  layoutCoseBtn: 'layout-cose-btn',
  layoutCircleBtn: 'layout-circle-btn',
  layoutConcentricBtn: 'layout-concentric-btn',
  layoutGridBtn: 'layout-grid-btn',
  layoutBreadthfirstBtn: 'layout-breadthfirst-btn',
  layoutRadialBtn: 'layout-radial-btn',
  layoutHierarchicalBtn: 'layout-hierarchical-btn',
  nodeTypeFilter: 'node-type-filter',

  // ── Query panel / resizer ─────────────────────────────────────────────────
  resizeH: 'resize-h',
  queryToggle: 'query-toggle',
  queryToggleLabel: 'query-toggle-label',
  queryPanelHeader: 'query-panel-header',
  runBtn: 'run-btn',
  queryInput: 'query-input',
  queryResults: 'query-results',

  // ── Bookmark bar (dynamically created inside QueryPanel) ─────────────────
  bookmarkBar: 'bookmark-bar',
  bookmarkSelect: 'bookmark-select',
  bookmarkSaveBtn: 'bookmark-save-btn',
  bookmarkDeleteBtn: 'bookmark-delete-btn',

  // ── Sidebar ───────────────────────────────────────────────────────────────
  sidebar: 'sidebar',
  sidebarEmpty: 'sidebar-empty',
  sidebarContent: 'sidebar-content',
  elementHeader: 'element-header',
  propertiesList: 'properties-list',
  noteTextarea: 'note-textarea',
  notePreview: 'note-preview',
  newPropKey: 'new-prop-key',
  newPropVal: 'new-prop-val',
  addPropBtn: 'add-prop-btn',

  // ── Mobile sidebar ────────────────────────────────────────────────────────
  sidebarOverlay: 'sidebar-overlay',
  sidebarToggleBtn: 'sidebar-toggle-btn',

  // ── Context menu / tooltip ────────────────────────────────────────────────
  contextMenu: 'context-menu',
  hoverTooltip: 'hover-tooltip',

  // ── Dialog shared overlay ────────────────────────────────────────────────
  dialogOverlay: 'dialog-overlay',

  // ── Create Node Dialog ────────────────────────────────────────────────────
  createNodeDialog: 'create-node-dialog',
  cndType: 'cnd-type',
  cndName: 'cnd-name',
  cndConfirm: 'cnd-confirm',
  cndCancel: 'cnd-cancel',

  // ── Create Edge Dialog ────────────────────────────────────────────────────
  createEdgeDialog: 'create-edge-dialog',
  cedType: 'ced-type',
  cedNewType: 'ced-new-type',
  cedAddTypeBtn: 'ced-add-type-btn',
  cedConfirm: 'ced-confirm',
  cedCancel: 'ced-cancel',

  // ── Node Type Style Dialog ────────────────────────────────────────────────
  nodeTypeStyleDialog: 'node-type-style-dialog',
  ntsList: 'nts-list',
  ntsNewInput: 'nts-new-input',
  ntsAddBtn: 'nts-add-btn',
  ntsCloseBtn: 'nts-close-btn',

  // ── Edge Type Style Dialog ────────────────────────────────────────────────
  edgeTypeStyleDialog: 'edge-type-style-dialog',
  etsList: 'ets-list',
  etsNewInput: 'ets-new-input',
  etsAddBtn: 'ets-add-btn',
  etsCloseBtn: 'ets-close-btn',

  // ── CSV Import Dialog ─────────────────────────────────────────────────────
  csvImportDialog: 'csv-import-dialog',
  cidFile: 'cid-file',
  cidPreview: 'cid-preview',
  cidNodeLabel: 'cid-node-label',
  cidNodeLabelList: 'cid-node-label-list',
  cidEdgeCols: 'cid-edge-cols',
  cidAddEdgeColBtn: 'cid-add-edge-col-btn',
  cidCancel: 'cid-cancel',
  cidConfirm: 'cid-confirm',
} as const;
