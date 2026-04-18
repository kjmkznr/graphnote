import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';
import type { MarkdownCell } from '../../types.js';
import { el } from '../domUtils.js';
import { makeMarkdownEditor } from '../markdownEditor.js';
import { makeCellHeader } from './cellHelpers.js';

export function renderMarkdownCell(cell: MarkdownCell, store: ScrapbookStore): HTMLElement {
  const wrap = el('div', {
    class: 'nb-cell nb-cell-markdown',
    'data-id': cell.id,
  });

  const header = makeCellHeader('Note', cell.id, store);
  wrap.appendChild(header);

  const { textarea, preview } = makeMarkdownEditor(
    cell.content,
    (value, immediate) => store.updateCell(cell.id, { content: value }, immediate),
    {
      textareaClass: 'nb-markdown-input',
      placeholder: 'Markdown でメモを書く…',
    },
  );

  wrap.appendChild(textarea);
  wrap.appendChild(preview);

  return wrap;
}
