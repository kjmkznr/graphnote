import type { AppContext } from '../appContext.js';
import type { GnId, RawNode } from '../types.js';
import { asGnId } from '../types.js';
import { SearchPanel } from '../ui/searchPanel.js';

const DEBOUNCE_MS = 150;

/**
 * Controller for the node search feature (Ctrl+F).
 * Manages the search panel lifecycle, search execution, and navigation.
 */
export function setupSearch(ctx: SearchContext): void {
  const panel = new SearchPanel();
  let matchGnIds: GnId[] = [];
  let activeIndex = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Keyboard shortcut: Ctrl+F / Cmd+F ───────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      // Only intercept when not in an input/textarea/contentEditable
      const active = document.activeElement;
      const isInInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable);

      // If search panel is already visible, don't prevent default (let normal Ctrl+F work)
      // unless we're not in an input
      if (panel.isVisible() && isInInput) return;

      e.preventDefault();
      if (!panel.isVisible()) {
        panel.show();
      } else {
        panel.focusInput();
      }
      return;
    }

    // Escape closes search panel when visible
    if (e.key === 'Escape' && panel.isVisible()) {
      e.preventDefault();
      closeSearch();
    }
  });

  // ── Panel callbacks ─────────────────────────────────────────────────────

  panel.setCallbacks({
    onInput(value) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => executeSearch(value), DEBOUNCE_MS);
    },
    onNext() {
      navigateNext();
    },
    onPrev() {
      navigatePrev();
    },
    onClose() {
      closeSearch();
    },
  });

  // ── Search execution ────────────────────────────────────────────────────

  function executeSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      matchGnIds = [];
      activeIndex = -1;
      ctx.canvas.clearHighlight();
      panel.clearMatchCount();
      return;
    }

    const lowerQuery = trimmed.toLowerCase();
    const filteredNodes = ctx.getFilteredNodes();

    matchGnIds = filteredNodes
      .filter((node) => matchesNode(node, lowerQuery))
      .map((node) => asGnId(node._properties.gnId as string))
      .filter(Boolean);

    if (matchGnIds.length === 0) {
      activeIndex = -1;
      ctx.canvas.clearHighlight();
      panel.setMatchCount(0, 0);
      return;
    }

    activeIndex = 0;
    highlightAll();
    navigateTo(activeIndex);
  }

  function matchesNode(node: RawNode, lowerQuery: string): boolean {
    const name = node._properties.name as string | undefined;
    if (name && name.toLowerCase().includes(lowerQuery)) return true;
    const label = node._labels[0] ?? '';
    if (label.toLowerCase().includes(lowerQuery)) return true;
    return false;
  }

  function highlightAll(): void {
    ctx.canvas.highlightByGnId(new Set(matchGnIds), new Set());
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  function navigateNext(): void {
    if (matchGnIds.length === 0) return;
    activeIndex = (activeIndex + 1) % matchGnIds.length;
    navigateTo(activeIndex);
  }

  function navigatePrev(): void {
    if (matchGnIds.length === 0) return;
    activeIndex = (activeIndex - 1 + matchGnIds.length) % matchGnIds.length;
    navigateTo(activeIndex);
  }

  function navigateTo(index: number): void {
    const gnId = matchGnIds[index];
    if (!gnId) return;

    panel.setMatchCount(index + 1, matchGnIds.length);

    // Pan to center the node on canvas
    const cy = ctx.canvas.getCy();
    const el = cy.getElementById(gnId);
    if (el && el.isNode()) {
      const pos = el.position();
      const zoom = cy.zoom();
      cy.animate({
        pan: {
          x: cy.width() / 2 - pos.x * zoom,
          y: cy.height() / 2 - pos.y * zoom,
        },
        duration: 200,
      });
    }
  }

  function closeSearch(): void {
    panel.hide();
    panel.setInputValue('');
    panel.clearMatchCount();
    ctx.canvas.clearHighlight();
    matchGnIds = [];
    activeIndex = -1;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }
}

/**
 * Minimal context required by the search controller.
 */
export interface SearchContext {
  readonly canvas: AppContext['canvas'];
  getFilteredNodes(): RawNode[];
}
