import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';
import type { SectionCell } from '../../types.js';
import { el } from '../domUtils.js';

export function renderSectionCell(cell: SectionCell, store: ScrapbookStore): HTMLElement {
  const wrap = el('div', {
    class: 'scrap-section-title',
    'data-id': cell.id,
  });

  const titleEl = el('h3', {});
  titleEl.textContent = cell.title;
  titleEl.setAttribute('contenteditable', 'true');
  titleEl.setAttribute('spellcheck', 'false');
  titleEl.addEventListener('blur', () => {
    const newTitle = titleEl.textContent?.trim() ?? '';
    if (newTitle !== cell.title) {
      store.updateCell(cell.id, { title: newTitle } as Partial<SectionCell>);
    }
  });
  titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleEl.blur();
    }
  });
  wrap.appendChild(titleEl);

  const deleteBtn = el('button', { class: 'scrap-section-delete-btn', title: '削除' }, '✕');
  deleteBtn.addEventListener('click', () => {
    store.deleteCell(cell.id);
  });
  wrap.appendChild(deleteBtn);

  return wrap;
}
