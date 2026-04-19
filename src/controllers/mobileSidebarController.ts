import { DOM_IDS } from '../ui/domIds.js';
import { byId } from '../ui/domUtils.js';

/**
 * Responsive drawer controller.
 *
 * Breakpoints:
 *   lg ≥ 1100px — standard 3-panel, no drawers
 *   md 700–1099 — left rail icon-strip (40px), right sidebar slides in as overlay
 *   sm < 700    — both panels are drawers; hamburger in topbar
 */
export class MobileSidebarController {
  private readonly elSidebar = byId(DOM_IDS.sidebar);
  private readonly elRail = byId('left-rail');
  private readonly elBackdrop = byId(DOM_IDS.drawerBackdrop);
  private readonly elPropsToggle = byId(DOM_IDS.propsToggleBtn);
  private readonly elRailToggle = byId(DOM_IDS.railToggleBtn);

  // compat: kept for old code that references these
  private readonly elSidebarToggleBtn = byId(DOM_IDS.sidebarToggleBtn);
  private readonly elSidebarOverlay = byId(DOM_IDS.sidebarOverlay);

  setup(): void {
    // Props-toggle button (canvas toolbar)
    this.elPropsToggle.addEventListener('click', () => {
      if (this.elSidebar.dataset['open'] === 'true') {
        this.closeSidebar();
      } else {
        this.openSidebar();
      }
    });

    // Rail-toggle button (topbar hamburger)
    // Controls #left-rail on graph tab, .scrap-rail on scrapbook tab
    this.elRailToggle.addEventListener('click', () => {
      const scrapRail = document.querySelector<HTMLElement>('.scrap-rail');
      const activeRail = scrapRail && this.isScrapbookVisible() ? scrapRail : this.elRail;
      if (activeRail.dataset['open'] === 'true') {
        activeRail.dataset['open'] = 'false';
        if (this.elSidebar.dataset['open'] !== 'true') this.hideBackdrop();
      } else {
        activeRail.dataset['open'] = 'true';
        this.showBackdrop();
      }
    });

    // Backdrop closes whichever drawer is open
    this.elBackdrop.addEventListener('click', () => this.closeAll());

    // Close all drawers when switching tabs
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.closeAll());
    });

    // Legacy compat
    this.elSidebarToggleBtn.addEventListener('click', () => {
      if (this.elSidebar.dataset['open'] === 'true') {
        this.closeSidebar();
      } else {
        this.openSidebar();
      }
    });
    this.elSidebarOverlay.addEventListener('click', () => this.closeAll());
  }

  /** True when the viewport is narrow enough that sidebar acts as overlay */
  isMobile(): boolean {
    return window.matchMedia('(max-width: 1099px)').matches;
  }

  private isScrapbookVisible(): boolean {
    const el = document.getElementById(DOM_IDS.tabScrapbook);
    return !!el && el.style.display !== 'none';
  }

  /** Open sidebar overlay (props panel) */
  open(): void {
    this.openSidebar();
  }

  close(): void {
    this.closeSidebar();
  }

  private openSidebar(): void {
    this.elSidebar.dataset['open'] = 'true';
    this.showBackdrop();
    // legacy compat
    this.elSidebar.classList.add('mobile-open');
    this.elSidebarOverlay.classList.add('active');
  }

  private closeSidebar(): void {
    this.elSidebar.dataset['open'] = 'false';
    this.elSidebar.classList.remove('mobile-open');
    this.elSidebarOverlay.classList.remove('active');
    if (this.elRail.dataset['open'] !== 'true') this.hideBackdrop();
  }

  private closeRail(): void {
    this.elRail.dataset['open'] = 'false';
    if (this.elSidebar.dataset['open'] !== 'true') this.hideBackdrop();
  }

  closeAll(): void {
    this.closeSidebar();
    this.closeRail();
    // Also close scrapbook rail if visible
    const scrapRail = document.querySelector<HTMLElement>('.scrap-rail');
    if (scrapRail) scrapRail.dataset['open'] = 'false';
    this.hideBackdrop();
  }

  private showBackdrop(): void {
    this.elBackdrop.dataset['show'] = 'true';
  }

  private hideBackdrop(): void {
    this.elBackdrop.dataset['show'] = 'false';
  }
}
