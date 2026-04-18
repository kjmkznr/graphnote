import type { ScrapbookStore } from '../../notebook/scrapbookStore.js';
import { el } from '../domUtils.js';
import { makeMarkdownEditor } from '../markdownEditor.js';

// Kind accent colours
export const KIND_COLOR = {
  snapshot: 'var(--accent)',
  markdown: 'oklch(0.74 0.14 300)',
  'query-result': 'oklch(0.75 0.14 60)',
  section: 'var(--text-dim)',
} as const;

export function formatCellDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

// Build `.scrap-kind` row with coloured dot
export function makeKindRow(kindLabel: string, color: string, ts: number): HTMLElement {
  const row = el('div', { class: 'scrap-kind' });
  const dot = el('span', { class: 'dot' });
  dot.style.background = color;
  row.appendChild(dot);
  row.appendChild(document.createTextNode(`${kindLabel} · ${formatCellDate(ts)}`));
  return row;
}

// Build `.scrap-aside` with a delete button
export function makeAside(cellId: string, store: ScrapbookStore): HTMLElement {
  const aside = el('div', { class: 'scrap-aside' });
  const deleteBtn = el('button', { class: 'scrap-delete-btn', title: '削除' }, '✕');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    store.deleteCell(cellId);
  });
  aside.appendChild(deleteBtn);
  return aside;
}

// ── Legacy helpers kept for queryResultCell ─────────────────────────────────

export function makeCellHeader(
  kindLabel: string,
  cellId: string,
  store: ScrapbookStore,
): HTMLElement {
  const header = el('div', { class: 'nb-cell-header' });
  const badge = el(
    'span',
    {
      class: `nb-cell-badge nb-badge-${kindLabel.toLowerCase().replace(' ', '-')}`,
    },
    kindLabel,
  );
  header.appendChild(badge);

  const deleteBtn = el('button', { class: 'nb-cell-delete-btn', title: 'セルを削除' }, '✕');
  deleteBtn.addEventListener('click', () => {
    store.deleteCell(cellId);
  });
  header.appendChild(deleteBtn);
  return header;
}

export function attachMemoButton(header: HTMLElement): void {
  const memoBtn = el('button', { class: 'nb-cell-memo-btn', title: 'メモ' }, '📝');
  const badge = header.querySelector('.nb-cell-badge');
  if (badge?.nextSibling) {
    header.insertBefore(memoBtn, badge.nextSibling);
  } else {
    header.appendChild(memoBtn);
  }
  memoBtn.addEventListener('click', () => {
    const wrap = memoBtn.closest('.nb-cell');
    const memoWrap = wrap?.querySelector<HTMLElement>('.nb-query-memo-wrap');
    if (!memoWrap) return;
    const hidden = memoWrap.classList.toggle('nb-hidden');
    if (!hidden) {
      const textarea = memoWrap.querySelector<HTMLTextAreaElement>('.nb-query-memo');
      if (textarea && !textarea.value) {
        const preview = memoWrap.querySelector<HTMLElement>('.nb-query-memo-preview');
        preview?.classList.add('nb-hidden');
        textarea.classList.remove('nb-hidden');
        textarea.focus();
      }
    }
  });
}

export function makeMemoSection(
  cellId: string,
  initialMemo: string | undefined,
  store: ScrapbookStore,
): HTMLElement {
  const memoWrap = el('div', { class: 'nb-query-memo-wrap nb-hidden' });

  const { textarea: memoTextarea, preview: memoPreview } = makeMarkdownEditor(
    initialMemo ?? '',
    (value, immediate) => store.updateCell(cellId, { memo: value }, immediate),
    {
      textareaClass: 'nb-query-memo',
      previewClass: 'nb-query-memo-preview nb-markdown-preview',
      placeholder: 'メモを入力… (Markdown)',
    },
  );

  if (initialMemo) {
    memoWrap.classList.remove('nb-hidden');
  }

  memoWrap.appendChild(memoTextarea);
  memoWrap.appendChild(memoPreview);
  return memoWrap;
}
