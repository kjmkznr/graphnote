import { DOM_IDS } from './domIds.js';
import { byId } from './domUtils.js';

// サイドバー幅の下限: プロパティ名が折り返さずに表示できる最小幅
const SIDEBAR_MIN = 160;
// サイドバー幅の上限: 画面の半分程度を占める最大幅
const SIDEBAR_MAX = 700;
// クエリパネル高さの下限: 1〜2 行のクエリ入力と結果が見える最小高さ
const QUERY_MIN = 80;
// クエリパネル高さの上限: 画面の大半を占めないよう抑える最大高さ
const QUERY_MAX = 600;
// クエリパネルの初期高さ: 数行のクエリと結果が快適に閲覧できるデフォルト値
const QUERY_DEFAULT = 220;

// Threshold in px: drags shorter than this are treated as clicks
const DRAG_THRESHOLD = 4;

function setVar(name: string, value: number): void {
  document.documentElement.style.setProperty(name, `${value}px`);
}

function getVar(name: string, fallback: number): number {
  const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue(name), 10);
  return Number.isNaN(v) ? fallback : v;
}

export function initResizers(onResize: () => void, onQueryPanelCollapse?: () => void): void {
  const app = byId(DOM_IDS.app);

  // ── Horizontal resizer (canvas | sidebar) ────────────────────────────────

  const resizeH = byId(DOM_IDS.resizeH);

  resizeH.addEventListener('mousedown', (startEvent) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = getVar('--sidebar-w', 300);

    function onMove(e: MouseEvent): void {
      const newWidth = Math.max(
        SIDEBAR_MIN,
        Math.min(SIDEBAR_MAX, startWidth + startX - e.clientX),
      );
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

  const toggle = byId(DOM_IDS.queryToggle);
  const toggleLabel = byId(DOM_IDS.queryToggleLabel);
  let collapsed = true;
  let lastOpenHeight = QUERY_DEFAULT;

  function applyState(): void {
    setVar('--query-h', collapsed ? 0 : lastOpenHeight);
    toggleLabel.textContent = collapsed ? 'Cypher  ▲' : 'Cypher  ▼';
    onResize();
  }

  // Start collapsed
  applyState();

  function handleToggleStart(
    _startX: number,
    startY: number,
    addMoveListener: (fn: (_x: number, y: number) => void) => void,
    addUpListener: (fn: () => void) => void,
  ): void {
    let dragged = false;
    const startHeight = collapsed ? lastOpenHeight : getVar('--query-h', lastOpenHeight);

    addMoveListener((_x, y) => {
      const delta = startY - y;
      if (!dragged && Math.abs(delta) < DRAG_THRESHOLD) return;

      if (!dragged) {
        dragged = true;
        collapsed = false;
      }
      const newHeight = Math.max(QUERY_MIN, Math.min(QUERY_MAX, startHeight + delta));
      lastOpenHeight = newHeight;
      setVar('--query-h', newHeight);
      toggleLabel.textContent = 'Cypher  ▼';
      onResize();
    });

    addUpListener(() => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      app.style.pointerEvents = '';

      if (!dragged) {
        const wasCollapsed = collapsed;
        collapsed = !collapsed;
        if (!collapsed) lastOpenHeight = lastOpenHeight || QUERY_DEFAULT;
        applyState();
        if (!wasCollapsed && collapsed) onQueryPanelCollapse?.();
      }
    });

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    app.style.pointerEvents = 'none';
    toggle.style.pointerEvents = 'auto';
  }

  toggle.addEventListener('mousedown', (startEvent) => {
    startEvent.preventDefault();

    function onMove(e: MouseEvent): void {
      moveCallback(e.clientX, e.clientY);
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      upCallback();
    }

    let moveCallback: (x: number, y: number) => void = () => {
      /* noop */
    };
    let upCallback: () => void = () => {
      /* noop */
    };

    handleToggleStart(
      startEvent.clientX,
      startEvent.clientY,
      (fn) => {
        moveCallback = fn;
        document.addEventListener('mousemove', onMove);
      },
      (fn) => {
        upCallback = fn;
        document.addEventListener('mouseup', onUp);
      },
    );
  });

  toggle.addEventListener(
    'touchstart',
    (startEvent) => {
      if (startEvent.touches.length !== 1) return;
      const touch = startEvent.touches[0];
      if (!touch) return;

      function onMove(e: TouchEvent): void {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        if (!t) return;
        moveCallback(t.clientX, t.clientY);
      }
      function onUp(): void {
        toggle.removeEventListener('touchmove', onMove);
        toggle.removeEventListener('touchend', onUp);
        upCallback();
      }

      let moveCallback: (x: number, y: number) => void = () => {
        /* noop */
      };
      let upCallback: () => void = () => {
        /* noop */
      };

      handleToggleStart(
        touch.clientX,
        touch.clientY,
        (fn) => {
          moveCallback = fn;
          toggle.addEventListener('touchmove', onMove, { passive: false });
        },
        (fn) => {
          upCallback = fn;
          toggle.addEventListener('touchend', onUp);
        },
      );
    },
    { passive: true },
  );
}
