import type { NodeTypeFilterContext } from '../appContext.js';
import type { RawEdge, RawNode } from '../types.js';
import { DOM_IDS } from '../ui/domIds.js';
import { byId } from '../ui/domUtils.js';

export class NodeTypeFilterController {
  private readonly ctx: NodeTypeFilterContext;
  private readonly elNodeTypeFilter = byId<HTMLSelectElement>(DOM_IDS.nodeTypeFilter);
  private activeNodeTypeFilter: string | null = null;

  constructor(ctx: NodeTypeFilterContext) {
    this.ctx = ctx;
  }

  setup(): void {
    this.elNodeTypeFilter.addEventListener('change', () => {
      this.activeNodeTypeFilter = this.elNodeTypeFilter.value || null;
      this.ctx.canvas.refreshGraph(this.getFilteredNodes(), this.getFilteredEdges());
    });
  }

  getFilteredNodes(): RawNode[] {
    const nodes = this.ctx.db.getAllNodes();
    const activeType = this.activeNodeTypeFilter;
    if (!activeType) return nodes;
    return nodes.filter((n) => n._labels.includes(activeType));
  }

  getFilteredEdges(): RawEdge[] {
    if (!this.activeNodeTypeFilter) return this.ctx.db.getAllEdges();
    const filteredNodes = this.getFilteredNodes();
    const internalIds = new Set(filteredNodes.map((n) => n._id));
    return this.ctx.db
      .getAllEdges()
      .filter((e) => internalIds.has(e._src) && internalIds.has(e._dst));
  }

  updateOptions(): void {
    const current = this.elNodeTypeFilter.value;
    const types = this.ctx.registry.getAll().sort();
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
}
