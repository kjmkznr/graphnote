import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import type { CanvasEventContext } from '../appContext.js';
import type { CanvasEvent, GnId, RawEdge, RawNode, SnapshotCell } from '../types.js';
import { showCreateEdgeDialog } from '../ui/createEdgeDialog.js';
import { showCreateNodeDialog } from '../ui/createNodeDialog.js';
import { DOM_IDS } from '../ui/domIds.js';
import { byId, clearChildren, el, escHtml } from '../ui/domUtils.js';
import { showToast } from '../ui/toast.js';
import { escStr, extractMatchedGnIds } from '../utils/graphUtils.js';

const syncMarked = new Marked({ async: false });

// ── Tooltip ───────────────────────────────────────────────────────────────────

function buildNodeTooltipContent(node: RawNode): string {
  const label = node._labels[0] ?? '';
  const props = node._properties;
  const name = (props.name as string | undefined) ?? '';
  const note = (props.note as string | undefined) ?? '';

  const lines: string[] = [];
  if (name) lines.push(`<strong>${escHtml(name)}</strong>`);
  if (label) lines.push(`<span class="tooltip-label">:${escHtml(label)}</span>`);

  const skipKeys = new Set(['gnId', 'name', 'note']);
  const propEntries = Object.entries(props).filter(([k]) => !skipKeys.has(k));
  if (propEntries.length > 0) {
    lines.push('<div class="tooltip-props">');
    for (const [k, v] of propEntries) {
      lines.push(
        `<div><span class="tooltip-key">${escHtml(k)}:</span> ${escHtml(String(v ?? ''))}</div>`,
      );
    }
    lines.push('</div>');
  }

  if (note) {
    const preview = note.length > 200 ? `${note.slice(0, 200)}…` : note;
    lines.push(
      `<div class="tooltip-note tooltip-note-md">${DOMPurify.sanitize(syncMarked.parse(preview) as string)}</div>`,
    );
  }

  return lines.join('');
}

function buildEdgeTooltipContent(edge: RawEdge): string {
  const lines: string[] = [];
  lines.push(`<strong>${escHtml(edge._type)}</strong>`);

  const skipKeys = new Set(['gnId']);
  const propEntries = Object.entries(edge._properties).filter(([k]) => !skipKeys.has(k));
  if (propEntries.length > 0) {
    lines.push('<div class="tooltip-props">');
    for (const [k, v] of propEntries) {
      lines.push(
        `<div><span class="tooltip-key">${escHtml(k)}:</span> ${escHtml(String(v ?? ''))}</div>`,
      );
    }
    lines.push('</div>');
  }

  return lines.join('');
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

  setTimeout(
    () =>
      document.addEventListener('click', () => hideContextMenu(ctxMenu), {
        once: true,
      }),
    0,
  );
}

function hideContextMenu(ctxMenu: HTMLElement): void {
  ctxMenu.style.display = 'none';
}

// ── CanvasEventController ─────────────────────────────────────────────────────

export class CanvasEventController {
  private readonly ctx: CanvasEventContext;
  private readonly ctxMenu = byId(DOM_IDS.contextMenu);
  private readonly tooltip = byId(DOM_IDS.hoverTooltip);

  constructor(ctx: CanvasEventContext) {
    this.ctx = ctx;
  }

  handleCanvasEvent(event: CanvasEvent): void {
    switch (event.kind) {
      case 'canvas-clicked':
        return this.handleCanvasClicked(event.position);
      case 'node-clicked':
        return this.handleNodeClicked(event.gnId);
      case 'edge-clicked':
        return this.handleEdgeClicked(event.gnId);
      case 'edge-created':
        return this.handleEdgeCreated(event.sourceGnId, event.targetGnId);
      case 'edge-drag-cancelled':
        return this.ctx.canvas.setMode('edit');
      case 'node-context':
        return this.handleNodeContext(event.gnId, event.x, event.y);
      case 'edge-context':
        return this.handleEdgeContext(event.gnId, event.x, event.y);
      case 'bg-context':
        return this.handleBgContext(event.x, event.y);
      case 'bg-tap':
        return this.ctx.canvas.clearHighlight();
      case 'delete-selected':
        return this.handleDeleteSelected(event.nodeGnIds, event.edgeGnIds);
      case 'node-hovered':
        return this.handleNodeHovered(event.gnId, event.x, event.y);
      case 'edge-hovered':
        return this.handleEdgeHovered(event.gnId, event.x, event.y);
      case 'element-unhovered':
        return hideTooltip(this.tooltip);
    }
  }

  private handleNodeHovered(gnId: GnId, x: number, y: number): void {
    const node = this.ctx.db.getNodeByGnId(gnId);
    if (!node) return;
    showTooltip(this.tooltip, buildNodeTooltipContent(node), x, y);
  }

  private handleEdgeHovered(gnId: GnId, x: number, y: number): void {
    const edge = this.ctx.db.getEdgeByGnId(gnId);
    if (!edge) return;
    showTooltip(this.tooltip, buildEdgeTooltipContent(edge), x, y);
  }

  private handleCanvasClicked(position: { x: number; y: number }): void {
    showCreateNodeDialog(this.ctx.registry).then((result) => {
      this.ctx.canvas.setMode('edit');
      if (!result) return;
      try {
        this.ctx.captureForUndo();
        this.ctx.registry.ensure(result.type);
        const gnId = this.ctx.db.createNode(result.type, { name: result.name });
        this.ctx.canvas.hintPosition(gnId, position);
        this.ctx.refreshAndSave();
      } catch (err) {
        showToast(`ノードの作成に失敗しました: ${String(err)}`, 'warn');
      }
    });
  }

  private handleNodeClicked(gnId: GnId): void {
    const node = this.ctx.db.getNodeByGnId(gnId);
    if (node) {
      this.ctx.sidebar.showNode(node);
      if (this.ctx.isMobile()) this.ctx.openMobileSidebar();
    }
    this.highlightConnected(gnId);
  }

  private highlightConnected(gnId: GnId): void {
    try {
      const escaped = escStr(gnId);
      const nodeRows = this.ctx.db.execute<Record<string, unknown>>(
        `MATCH (n)--(m) WHERE n.gnId = "${escaped}" RETURN m`,
      );
      const edgeRows = this.ctx.db.execute<Record<string, unknown>>(
        `MATCH (n)-[r]-() WHERE n.gnId = "${escaped}" RETURN r`,
      );
      const { nodeGnIds } = extractMatchedGnIds(nodeRows);
      const { edgeGnIds } = extractMatchedGnIds(edgeRows);
      nodeGnIds.add(gnId);
      this.ctx.canvas.highlightByGnId(nodeGnIds, edgeGnIds);
    } catch {
      // ハイライト失敗は無視
    }
  }

  private handleEdgeClicked(gnId: GnId): void {
    const edge = this.ctx.db.getEdgeByGnId(gnId);
    if (edge) {
      this.ctx.sidebar.showEdge(edge);
      if (this.ctx.isMobile()) this.ctx.openMobileSidebar();
    }
  }

  private handleEdgeCreated(sourceGnId: GnId, targetGnId: GnId): void {
    showCreateEdgeDialog(this.ctx.edgeRegistry).then((type) => {
      this.ctx.canvas.setMode('edit');
      if (!type) return;
      try {
        this.ctx.captureForUndo();
        this.ctx.db.createEdge(sourceGnId, targetGnId, type);
        this.ctx.refreshAndSave();
      } catch (err) {
        showToast(`エッジの作成に失敗しました: ${String(err)}`);
        console.error('Failed to create edge:', err);
      }
    });
  }

  private handleNodeContext(gnId: GnId, x: number, y: number): void {
    showContextMenu(
      this.ctxMenu,
      [
        {
          label: 'ノードを削除',
          danger: true,
          action: () => this.handleDeleteSelected([gnId], []),
        },
      ],
      x,
      y,
    );
  }

  private handleEdgeContext(gnId: GnId, x: number, y: number): void {
    showContextMenu(
      this.ctxMenu,
      [
        {
          label: 'エッジを削除',
          danger: true,
          action: () => this.handleDeleteSelected([], [gnId]),
        },
      ],
      x,
      y,
    );
  }

  private handleDeleteSelected(nodeGnIds: GnId[], edgeGnIds: GnId[]): void {
    this.ctx.captureForUndo();
    for (const gnId of edgeGnIds) {
      try {
        this.ctx.db.deleteEdge(gnId);
      } catch {
        /* ignore */
      }
    }
    for (const gnId of nodeGnIds) {
      try {
        this.ctx.db.deleteNode(gnId);
      } catch {
        /* ignore */
      }
    }
    this.ctx.sidebar.hide();
    this.ctx.refreshAndSave();
  }

  private handleBgContext(x: number, y: number): void {
    const canvasPos = this.ctx.canvas.clientToCanvasPosition(x, y);
    showContextMenu(
      this.ctxMenu,
      [
        {
          label: 'ノードを作成',
          action: () => {
            showCreateNodeDialog(this.ctx.registry).then((result) => {
              if (!result) return;
              try {
                this.ctx.captureForUndo();
                this.ctx.registry.ensure(result.type);
                const gnId = this.ctx.db.createNode(result.type, {
                  name: result.name,
                });
                this.ctx.canvas.hintPosition(gnId, canvasPos);
                this.ctx.refreshAndSave();
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
      ],
      x,
      y,
    );
  }

  private sendSnapshotToScrapbook(): void {
    const label = `Snapshot ${new Date().toLocaleString('ja-JP')}`;
    const positions = this.ctx.canvas.getPositions();
    const pngDataUrl = this.ctx.canvas.png();
    const cell: SnapshotCell = {
      id: crypto.randomUUID(),
      kind: 'snapshot',
      createdAt: Date.now(),
      label,
      positions,
      pngDataUrl,
    };
    this.ctx.scrapbookStore.addCell(cell);
    showToast('Scrapbook にスナップショットを送りました', 'success');
  }
}
