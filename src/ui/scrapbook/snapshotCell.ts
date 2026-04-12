import type { SnapshotCell } from '../../types.js';
import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';
import { el } from '../domUtils.js';
import { makeCellHeader, attachMemoButton, makeMemoSection } from './cellHelpers.js';

export function renderSnapshotCell(cell: SnapshotCell, store: ScrapbookStore): HTMLElement {
  const wrap = el('div', { class: 'nb-cell nb-cell-snapshot', 'data-id': cell.id });

  const header = makeCellHeader('Snapshot', cell.id, store);
  attachMemoButton(header);
  wrap.appendChild(header);

  const memoWrap = makeMemoSection(cell.id, cell.memo, store);
  wrap.appendChild(memoWrap);

  const label = el('div', { class: 'nb-snapshot-label' }, cell.label);
  wrap.appendChild(label);

  const img = el('img', { class: 'nb-snapshot-thumbnail', src: cell.pngDataUrl, alt: cell.label }) as HTMLImageElement;
  const imgWrap = el('div', { class: 'nb-snapshot-img-wrap' });
  imgWrap.appendChild(img);
  imgWrap.addEventListener('click', () => {
    openSnapshotModal(cell);
  });
  wrap.appendChild(imgWrap);

  return wrap;
}

function openSnapshotModal(cell: SnapshotCell): void {
  const overlay = el('div', { class: 'nb-snapshot-modal-overlay' });
  const modalImg = el('img', { class: 'nb-snapshot-modal-img', src: cell.pngDataUrl, alt: cell.label }) as HTMLImageElement;
  overlay.appendChild(modalImg);
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
