import type cytoscape from "cytoscape";

/**
 * A lightweight Canvas2D minimap for the Cytoscape graph.
 * Shows a simplified overview of all nodes/edges with a viewport rectangle,
 * and supports click/drag to pan the main view.
 */
export class Minimap {
  private el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cy: cytoscape.Core;
  private dragging = false;
  private renderPending = false;
  private readonly W = 180;
  private readonly H = 130;
  private readonly dpr: number;

  constructor(wrapContainer: HTMLElement, cy: cytoscape.Core) {
    this.cy = cy;
    this.dpr = window.devicePixelRatio || 1;

    this.el = document.createElement("div");
    this.el.id = "minimap";
    wrapContainer.appendChild(this.el);

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.canvas.style.display = "block";
    this.el.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.scale(this.dpr, this.dpr);

    this.bindCyEvents();
    this.bindMouseEvents();
    this.scheduleRender();
  }

  // ── Cy event binding ─────────────────────────────────────────

  private bindCyEvents(): void {
    this.cy.on("viewport add remove position", () => this.scheduleRender());
  }

  // ── Mouse event binding ──────────────────────────────────────

  private bindMouseEvents(): void {
    this.canvas.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.dragging = true;
      this.panToMouse(e);
    });

    const onMove = (e: MouseEvent) => {
      if (!this.dragging) return;
      e.preventDefault();
      this.panToMouse(e);
    };

    const onUp = () => {
      this.dragging = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── Transform (graph coords → minimap coords) ───────────────

  private getTransform(): {
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null {
    const nodes = this.cy.nodes("[!ghost][!edgeHandle]");
    if (nodes.length === 0) return null;

    const bb = nodes.boundingBox();
    const pad = 15;
    const availW = this.W - pad * 2;
    const availH = this.H - pad * 2;
    const graphW = Math.max(bb.w, 1);
    const graphH = Math.max(bb.h, 1);
    const scale = Math.min(availW / graphW, availH / graphH);
    const offsetX = pad + (availW - graphW * scale) / 2 - bb.x1 * scale;
    const offsetY = pad + (availH - graphH * scale) / 2 - bb.y1 * scale;
    return { scale, offsetX, offsetY };
  }

  // ── Pan main view to minimap click position ──────────────────

  private panToMouse(e: MouseEvent): void {
    const t = this.getTransform();
    if (!t) return;

    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Minimap coords → graph coords
    const graphX = (mx - t.offsetX) / t.scale;
    const graphY = (my - t.offsetY) / t.scale;

    // Pan so the clicked graph point is centred in the viewport
    const container = this.cy.container()!;
    const zoom = this.cy.zoom();
    this.cy.pan({
      x: container.clientWidth / 2 - graphX * zoom,
      y: container.clientHeight / 2 - graphY * zoom,
    });
  }

  // ── Rendering ────────────────────────────────────────────────

  scheduleRender(): void {
    if (this.renderPending) return;
    this.renderPending = true;
    requestAnimationFrame(() => {
      this.renderPending = false;
      this.render();
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "rgba(15, 17, 23, 0.9)";
    ctx.fillRect(0, 0, W, H);

    const t = this.getTransform();
    if (!t) {
      this.el.style.display = "none";
      return;
    }
    this.el.style.display = "";

    const { scale, offsetX, offsetY } = t;

    // Draw edges
    ctx.strokeStyle = "rgba(74, 85, 104, 0.5)";
    ctx.lineWidth = 0.5;
    this.cy.edges("[!ghost]").forEach((edge) => {
      const src = edge.source();
      const tgt = edge.target();
      if (src.data("ghost") || src.data("edgeHandle")) return;
      if (tgt.data("ghost") || tgt.data("edgeHandle")) return;
      const sp = src.position();
      const tp = tgt.position();
      ctx.beginPath();
      ctx.moveTo(sp.x * scale + offsetX, sp.y * scale + offsetY);
      ctx.lineTo(tp.x * scale + offsetX, tp.y * scale + offsetY);
      ctx.stroke();
    });

    // Draw nodes
    this.cy.nodes("[!ghost][!edgeHandle]").forEach((node) => {
      const pos = node.position();
      const x = pos.x * scale + offsetX;
      const y = pos.y * scale + offsetY;
      const color = (node.data("color") as string) || "#6c8ef7";
      const r = Math.min(Math.max(28 * scale, 2), 5);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw viewport rectangle
    const container = this.cy.container()!;
    const pan = this.cy.pan();
    const zoom = this.cy.zoom();

    const vx1 = -pan.x / zoom;
    const vy1 = -pan.y / zoom;
    const vx2 = (container.clientWidth - pan.x) / zoom;
    const vy2 = (container.clientHeight - pan.y) / zoom;

    const rx = vx1 * scale + offsetX;
    const ry = vy1 * scale + offsetY;
    const rw = (vx2 - vx1) * scale;
    const rh = (vy2 - vy1) * scale;

    ctx.strokeStyle = "rgba(108, 142, 247, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = "rgba(108, 142, 247, 0.06)";
    ctx.fillRect(rx, ry, rw, rh);
  }
}
