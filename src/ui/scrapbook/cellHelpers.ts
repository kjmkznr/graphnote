import type { ScrapbookStore } from "../../notebook/scrapbookStore.js";
import { el } from "../domUtils.js";
import { makeMarkdownEditor } from "../markdownEditor.js";

export function makeCellHeader(
  kindLabel: string,
  cellId: string,
  store: ScrapbookStore,
): HTMLElement {
  const header = el("div", { class: "nb-cell-header" });
  const badge = el(
    "span",
    {
      class: `nb-cell-badge nb-badge-${kindLabel.toLowerCase().replace(" ", "-")}`,
    },
    kindLabel,
  );
  header.appendChild(badge);

  const deleteBtn = el(
    "button",
    { class: "nb-cell-delete-btn", title: "セルを削除" },
    "✕",
  );
  deleteBtn.addEventListener("click", () => {
    store.deleteCell(cellId);
  });
  header.appendChild(deleteBtn);
  return header;
}

export function attachMemoButton(header: HTMLElement): void {
  const memoBtn = el(
    "button",
    { class: "nb-cell-memo-btn", title: "メモ" },
    "📝",
  );
  const badge = header.querySelector(".nb-cell-badge");
  if (badge && badge.nextSibling) {
    header.insertBefore(memoBtn, badge.nextSibling);
  } else {
    header.appendChild(memoBtn);
  }
  memoBtn.addEventListener("click", () => {
    const wrap = memoBtn.closest(".nb-cell");
    const memoWrap = wrap?.querySelector<HTMLElement>(".nb-query-memo-wrap");
    if (!memoWrap) return;
    const hidden = memoWrap.classList.toggle("nb-hidden");
    if (!hidden) {
      const textarea =
        memoWrap.querySelector<HTMLTextAreaElement>(".nb-query-memo");
      if (textarea && !textarea.value) {
        const preview = memoWrap.querySelector<HTMLElement>(
          ".nb-query-memo-preview",
        );
        preview?.classList.add("nb-hidden");
        textarea.classList.remove("nb-hidden");
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
  const memoWrap = el("div", { class: "nb-query-memo-wrap nb-hidden" });

  const { textarea: memoTextarea, preview: memoPreview } = makeMarkdownEditor(
    initialMemo ?? "",
    (value, immediate) => store.updateCell(cellId, { memo: value }, immediate),
    {
      textareaClass: "nb-query-memo",
      previewClass: "nb-query-memo-preview nb-markdown-preview",
      placeholder: "メモを入力… (Markdown)",
    },
  );

  if (initialMemo) {
    memoWrap.classList.remove("nb-hidden");
  }

  memoWrap.appendChild(memoTextarea);
  memoWrap.appendChild(memoPreview);
  return memoWrap;
}
