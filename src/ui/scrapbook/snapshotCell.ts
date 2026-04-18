import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';
import type { SnapshotCell } from '../../types.js';
import { el } from '../domUtils.js';
import { KIND_COLOR, makeAside, makeKindRow } from './cellHelpers.js';

export function renderSnapshotCell(cell: SnapshotCell, store: ScrapbookStore): HTMLElement {
  const wrap = el('div', {
    class: 'scrap-item',
    'data-type': 'snapshot',
    'data-id': cell.id,
  });

  // Thumbnail
  const thumb = el('div', { class: 'scrap-thumb' });
  const img = el('img', {
    src: cell.pngDataUrl,
    alt: cell.label,
    style: 'width:100%;height:100%;object-fit:cover;display:block;cursor:pointer',
  }) as HTMLImageElement;
  img.addEventListener('click', () => openSnapshotModal(cell));
  thumb.appendChild(img);
  wrap.appendChild(thumb);

  // Meta
  const meta = el('div', { class: 'scrap-meta' });
  meta.appendChild(makeKindRow('snapshot', KIND_COLOR.snapshot, cell.createdAt));
  meta.appendChild(el('div', { class: 'scrap-title' }, cell.label));
  wrap.appendChild(meta);

  // Aside
  wrap.appendChild(makeAside(cell.id, store));

  return wrap;
}

function openSnapshotModal(cell: SnapshotCell): void {
  const overlay = el('div', { class: 'nb-snapshot-modal-overlay' });
  const modalImg = el('img', {
    class: 'nb-snapshot-modal-img',
    src: cell.pngDataUrl,
    alt: cell.label,
  }) as HTMLImageElement;
  overlay.appendChild(modalImg);
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
