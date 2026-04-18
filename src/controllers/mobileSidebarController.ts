import { DOM_IDS } from '../ui/domIds.js';
import { byId } from '../ui/domUtils.js';

export class MobileSidebarController {
  private readonly elSidebar = byId(DOM_IDS.sidebar);
  private readonly elSidebarToggleBtn = byId(DOM_IDS.sidebarToggleBtn);
  private readonly elSidebarOverlay = byId(DOM_IDS.sidebarOverlay);

  setup(): void {
    this.elSidebarToggleBtn.addEventListener('click', () => {
      if (this.elSidebar.classList.contains('mobile-open')) {
        this.close();
      } else {
        this.open();
      }
    });

    this.elSidebarOverlay.addEventListener('click', () => {
      this.close();
    });
  }

  isMobile(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  open(): void {
    this.elSidebar.classList.add('mobile-open');
    this.elSidebarOverlay.classList.add('active');
    this.elSidebarToggleBtn.classList.add('active');
  }

  close(): void {
    this.elSidebar.classList.remove('mobile-open');
    this.elSidebarOverlay.classList.remove('active');
    this.elSidebarToggleBtn.classList.remove('active');
  }
}
