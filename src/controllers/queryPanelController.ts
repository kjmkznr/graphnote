import type { QueryPanelContext } from '../appContext.js';
import type { QueryResultCell } from '../types.js';
import type { CompletionContext } from '../ui/cypherAutocomplete.js';
import { showToast } from '../ui/toast.js';
import { escStr, extractMatchedGnIds, isEdgeValue } from '../utils/graphUtils.js';

function buildCompletionContext(ctx: QueryPanelContext): CompletionContext {
  const nodes = ctx.db.getAllNodes();
  const edges = ctx.db.getAllEdges();
  const propKeySet = new Set<string>();
  for (const node of nodes) {
    for (const key of Object.keys(node._properties)) propKeySet.add(key);
  }
  for (const edge of edges) {
    for (const key of Object.keys(edge._properties)) propKeySet.add(key);
  }
  return {
    nodeTypes: ctx.registry.getAll(),
    edgeTypes: ctx.edgeRegistry.getAll(),
    propertyKeys: [...propKeySet].sort(),
  };
}

export function refreshCompletionContext(ctx: QueryPanelContext): void {
  ctx.queryPanel.setCompletionContext(buildCompletionContext(ctx));
}

function enrichRowsWithEdges(
  ctx: QueryPanelContext,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const hasEdge = rows.some((row) => Object.values(row).some(isEdgeValue));
  if (hasEdge) return rows;

  const gnIds: string[] = [];
  for (const row of rows) {
    for (const val of Object.values(row)) {
      if (val === null || typeof val !== 'object' || Array.isArray(val)) continue;
      const obj = val as Record<string, unknown>;
      if (
        Array.isArray(obj._labels) &&
        typeof obj._properties === 'object' &&
        obj._properties !== null
      ) {
        const props = obj._properties as Record<string, unknown>;
        if (typeof props.gnId === 'string') gnIds.push(props.gnId);
      }
    }
  }
  if (gnIds.length === 0) return rows;

  try {
    const list = gnIds.map((id) => `"${escStr(id)}"`).join(', ');
    const edgeRows = ctx.db.execute<Record<string, unknown>>(
      `MATCH (a)-[r]->(b) WHERE a.gnId IN [${list}] AND b.gnId IN [${list}] RETURN r`,
    );
    if (edgeRows.length === 0) return rows;
    return [...rows, ...edgeRows];
  } catch {
    return rows;
  }
}

const WRITE_KEYWORDS = /\b(CREATE|MERGE|SET|DELETE|DETACH|REMOVE|DROP)\b/i;
const STRING_LITERAL = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function isWriteQuery(query: string): boolean {
  const stripped = query.replace(STRING_LITERAL, '');
  return WRITE_KEYWORDS.test(stripped);
}

async function refreshBookmarks(ctx: QueryPanelContext): Promise<void> {
  const bookmarks = await ctx.bookmarkStore.getAll();
  ctx.queryPanel.setBookmarks(bookmarks);
}

function logQueryExecutionMetrics(
  query: string,
  metrics: {
    executeMs: number;
    syncGraphDataMs: number;
    refreshGraphMs: number;
    highlightMs: number;
    enrichRowsMs: number;
    totalMs: number;
  },
): void {
  console.info('[perf] queryPanel.onExecute', {
    query,
    ...metrics,
  });
}

export function setupQueryPanel(ctx: QueryPanelContext): void {
  refreshCompletionContext(ctx);
  void refreshBookmarks(ctx);

  ctx.queryPanel.setCallbacks({
    onSaveBookmark(name, query) {
      void ctx.bookmarkStore.add(name, query).then(() => refreshBookmarks(ctx));
    },
    onDeleteBookmark(id) {
      void ctx.bookmarkStore.remove(id).then(() => refreshBookmarks(ctx));
    },
    onSelectBookmark() {
      /* handled internally by QueryPanel */
    },
    onExecute(query) {
      ctx.canvas.clearHighlight();
      if (isWriteQuery(query)) ctx.captureForUndo();
      const totalStart = performance.now();
      try {
        const executeStart = performance.now();
        const rows = ctx.db.execute(query);
        const executeElapsed = performance.now() - executeStart;
        ctx.queryPanel.showResult(rows, executeElapsed);

        const syncGraphDataStart = performance.now();
        const allNodes = ctx.db.getAllNodes();
        const allEdges = ctx.db.getAllEdges();
        const syncGraphDataElapsed = performance.now() - syncGraphDataStart;

        const refreshGraphStart = performance.now();
        ctx.canvas.refreshGraph(allNodes, allEdges);
        const refreshGraphElapsed = performance.now() - refreshGraphStart;

        ctx.scheduleSave();

        const { nodeGnIds, edgeGnIds } = extractMatchedGnIds(rows);
        const highlightStart = performance.now();
        ctx.canvas.highlightByGnId(nodeGnIds, edgeGnIds);
        const highlightElapsed = performance.now() - highlightStart;

        const enrichRowsStart = performance.now();
        const enrichedRows = enrichRowsWithEdges(ctx, rows as Record<string, unknown>[]);
        const enrichRowsElapsed = performance.now() - enrichRowsStart;
        const totalElapsed = performance.now() - totalStart;

        logQueryExecutionMetrics(query, {
          executeMs: executeElapsed,
          syncGraphDataMs: syncGraphDataElapsed,
          refreshGraphMs: refreshGraphElapsed,
          highlightMs: highlightElapsed,
          enrichRowsMs: enrichRowsElapsed,
          totalMs: totalElapsed,
        });

        const cell: QueryResultCell = {
          id: crypto.randomUUID(),
          kind: 'query-result',
          createdAt: Date.now(),
          query,
          rows: enrichedRows,
          elapsedMs: executeElapsed,
        };
        if (isWriteQuery(query)) ctx.scrapbookStore.addCell(cell);
      } catch (err) {
        ctx.queryPanel.showError(String(err));
        showToast(String(err), 'warn');
      }
    },
  });
}
