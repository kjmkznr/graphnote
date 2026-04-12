import type { AppContext } from '../appContext.js';
import type { CompletionContext } from '../ui/cypherAutocomplete.js';
import type { QueryResultCell } from '../types.js';
import { showToast } from '../ui/toast.js';
import { extractMatchedGnIds, isEdgeValue, escStr } from '../utils/graphUtils.js';

function buildCompletionContext(ctx: AppContext): CompletionContext {
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

export function refreshCompletionContext(ctx: AppContext): void {
  ctx.queryPanel.setCompletionContext(buildCompletionContext(ctx));
}

function enrichRowsWithEdges(ctx: AppContext, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const hasEdge = rows.some(row => Object.values(row).some(isEdgeValue));
  if (hasEdge) return rows;

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
    const list = gnIds.map(id => `"${escStr(id)}"`).join(', ');
    const edgeRows = ctx.db.execute<Record<string, unknown>>(
      `MATCH (a)-[r]->(b) WHERE a.gnId IN [${list}] AND b.gnId IN [${list}] RETURN r`
    );
    if (edgeRows.length === 0) return rows;
    return [...rows, ...edgeRows];
  } catch {
    return rows;
  }
}

export function setupQueryPanel(ctx: AppContext): void {
  refreshCompletionContext(ctx);
  ctx.queryPanel.onExecute((query) => {
    ctx.canvas.clearHighlight();
    ctx.captureForUndo();
    const t0 = performance.now();
    try {
      const rows = ctx.db.execute(query);
      const elapsed = performance.now() - t0;
      ctx.queryPanel.showResult(rows, elapsed);
      ctx.canvas.refreshGraph(ctx.db.getAllNodes(), ctx.db.getAllEdges());
      ctx.scheduleSave();
      const { nodeGnIds, edgeGnIds } = extractMatchedGnIds(rows);
      ctx.canvas.highlightByGnId(nodeGnIds, edgeGnIds);

      const cell: QueryResultCell = {
        id: crypto.randomUUID(),
        kind: 'query-result',
        createdAt: Date.now(),
        query,
        rows: enrichRowsWithEdges(ctx, rows as Record<string, unknown>[]),
        elapsedMs: elapsed,
      };
      ctx.scrapbookStore.addCell(cell);
    } catch (err) {
      ctx.queryPanel.showError(String(err));
      showToast(String(err), 'warn');
    }
  });
}
