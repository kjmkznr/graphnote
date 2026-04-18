import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';
import type { MarkdownCell } from '../../types.js';
import { el } from '../domUtils.js';
import { makeMarkdownEditor } from '../markdownEditor.js';
import { KIND_COLOR, makeAside, makeKindRow } from './cellHelpers.js';

export function renderMarkdownCell(cell: MarkdownCell, store: ScrapbookStore): HTMLElement {
  const wrap = el('div', {
    class: 'scrap-item scrap-item-note',
    'data-type': 'note',
    'data-id': cell.id,
  });

  const meta = el('div', { class: 'scrap-meta' });
  meta.appendChild(makeKindRow('note', KIND_COLOR.markdown, cell.createdAt));

  const { textarea, preview } = makeMarkdownEditor(
    cell.content,
    (value, immediate) => store.updateCell(cell.id, { content: value }, immediate),
    {
      textareaClass: 'nb-markdown-input scrap-md-input',
      previewClass: 'nb-markdown-preview scrap-md-preview',
      placeholder: 'Markdown でメモを書く…',
    },
  );

  // Show preview by default; click preview to switch to edit mode
  preview.addEventListener('click', () => {
    preview.classList.add('nb-hidden');
    textarea.classList.remove('nb-hidden');
    textarea.focus();
  });
  textarea.addEventListener('blur', () => {
    textarea.classList.add('nb-hidden');
    preview.classList.remove('nb-hidden');
  });

  meta.appendChild(preview);
  meta.appendChild(textarea);
  wrap.appendChild(meta);
  wrap.appendChild(makeAside(cell.id, store));

  return wrap;
}
