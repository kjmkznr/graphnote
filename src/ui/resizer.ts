const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 700;
const QUERY_MIN = 60;
const QUERY_MAX = 600;

function setVar(name: string, value: number): void {
  document.documentElement.style.setProperty(name, `${value}px`);
}

export function initResizers(onResize: () => void): void {
  const app = document.getElementById('app')!;

  // ── Horizontal resizer (canvas | sidebar) ────────────────────────────────

  const resizeH = document.getElementById('resize-h')!;

  resizeH.addEventListener('mousedown', (startEvent) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w') || '300',
    );

    function onMove(e: MouseEvent): void {
      const delta = startX - e.clientX;
      const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + delta));
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

  // ── Vertical resizer (canvas | query panel) ───────────────────────────────

  const resizeV = document.getElementById('resize-v')!;

  resizeV.addEventListener('mousedown', (startEvent) => {
    startEvent.preventDefault();
    const startY = startEvent.clientY;
    const startHeight = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--query-h') || '220',
    );

    function onMove(e: MouseEvent): void {
      const delta = startY - e.clientY;
      const newHeight = Math.max(QUERY_MIN, Math.min(QUERY_MAX, startHeight + delta));
      setVar('--query-h', newHeight);
      onResize();
    }

    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      app.style.pointerEvents = '';
    }

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    app.style.pointerEvents = 'none';
    resizeV.style.pointerEvents = 'auto';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
