import { byId } from './domUtils.js';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 700;
const QUERY_MIN = 80;
const QUERY_MAX = 600;
const QUERY_DEFAULT = 220;

// Threshold in px: drags shorter than this are treated as clicks
const DRAG_THRESHOLD = 4;

function setVar(name: string, value: number): void {
  document.documentElement.style.setProperty(name, `${value}px`);
}

function getVar(name: string, fallback: number): number {
  const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue(name));
  return isNaN(v) ? fallback : v;
}

export function initResizers(onResize: () => void, onQueryPanelCollapse?: () => void): void {
  const app = byId('app');

  // ── Horizontal resizer (canvas | sidebar) ────────────────────────────────

  const resizeH = byId('resize-h');

  resizeH.addEventListener('mousedown', (startEvent) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = getVar('--sidebar-w', 300);

    function onMove(e: MouseEvent): void {
      const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + startX - e.clientX));
      setVar('--sidebar-w', newWidth);
      onResize();
    }

    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      app.style.pointerEvents = '';
    }

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    app.style.pointerEvents = 'none';
    resizeH.style.pointerEvents = 'auto';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── Query toggle bar (click to open/close, drag to resize) ───────────────

  const toggle = byId('query-toggle');
  const toggleLabel = byId('query-toggle-label');
  let collapsed = true;
  let lastOpenHeight = QUERY_DEFAULT;

  function applyState(): void {
    setVar('--query-h', collapsed ? 0 : lastOpenHeight);
    toggleLabel.textContent = collapsed ? 'Cypher  ▲' : 'Cypher  ▼';
    onResize();
  }

  // Start collapsed
  applyState();

  toggle.addEventListener('mousedown', (startEvent) => {
    startEvent.preventDefault();
    const startY = startEvent.clientY;
    let dragged = false;
    const startHeight = collapsed ? lastOpenHeight : getVar('--query-h', lastOpenHeight);

    function onMove(e: MouseEvent): void {
      const delta = startY - e.clientY;
      if (!dragged && Math.abs(delta) < DRAG_THRESHOLD) return;

      if (!dragged) {
        // First real drag movement: ensure panel is open
        dragged = true;
        collapsed = false;
      }
      const newHeight = Math.max(QUERY_MIN, Math.min(QUERY_MAX, startHeight + delta));
      lastOpenHeight = newHeight;
      setVar('--query-h', newHeight);
      toggleLabel.textContent = 'Cypher  ▼';
      onResize();
    }

    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      app.style.pointerEvents = '';

      if (!dragged) {
        // Pure click: toggle
        const wasCollapsed = collapsed;
        collapsed = !collapsed;
        if (!collapsed) lastOpenHeight = lastOpenHeight || QUERY_DEFAULT;
        applyState();
        if (!wasCollapsed && collapsed) onQueryPanelCollapse?.();
      }
    }

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    app.style.pointerEvents = 'none';
    toggle.style.pointerEvents = 'auto';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
