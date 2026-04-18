import type { GraphDB } from '../graph/db.js';
import type { TabKind } from '../types.js';
import type { Canvas } from '../ui/canvas.js';
import type { Dashboard } from '../ui/dashboard.js';
import { DOM_IDS } from '../ui/domIds.js';
import { byId } from '../ui/domUtils.js';

function isTabKind(value: string): value is TabKind {
  return value === 'graph' || value === 'scrapbook' || value === 'dashboard';
}

export function setupTabButtons(canvas: Canvas, db: GraphDB, dashboard: Dashboard): void {
  const elTabGraph = byId(DOM_IDS.tabGraph);
  const elTabScrapbook = byId(DOM_IDS.tabScrapbook);
  const elTabDashboard = byId(DOM_IDS.tabDashboard);

  function switchTab(tab: TabKind, updateHistory = true): void {
    if (updateHistory) {
      history.replaceState(null, '', `#${tab}`);
    }
    elTabGraph.style.display = tab === 'graph' ? 'contents' : 'none';
    elTabScrapbook.style.display = tab === 'scrapbook' ? 'grid' : 'none';
    elTabDashboard.style.display = tab === 'dashboard' ? 'block' : 'none';
    document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'graph') {
      requestAnimationFrame(() => canvas.resize());
    }
    if (tab === 'dashboard') {
      dashboard.refresh(db.getAllNodes(), db.getAllEdges());
    }
  }

  document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab && isTabKind(tab)) switchTab(tab);
    });
  });

  const hash = location.hash.replace('#', '') as TabKind;
  const initialTab: TabKind =
    hash === 'graph' || hash === 'scrapbook' || hash === 'dashboard' ? hash : 'graph';
  switchTab(initialTab);
}
