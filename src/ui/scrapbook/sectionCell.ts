import type { SectionCell } from "../../types.js";
import type { ScrapbookStore } from "../../notebook/scrapbookStore.js";
import { el } from "../domUtils.js";

export function renderSectionCell(
  cell: SectionCell,
  store: ScrapbookStore,
): HTMLElement {
  const wrap = el("div", {
    class: "nb-cell nb-cell-section",
    "data-id": cell.id,
  });

  const deleteBtn = el(
    "button",
    {
      class: "nb-cell-delete-btn nb-section-delete-btn",
      title: "セクションを削除",
    },
    "✕",
  );
  deleteBtn.addEventListener("click", () => {
    store.deleteCell(cell.id);
  });

  const titleEl = el("span", { class: "nb-section-title" }, cell.title);
  titleEl.setAttribute("contenteditable", "true");
  titleEl.setAttribute("spellcheck", "false");
  titleEl.addEventListener("blur", () => {
    const newTitle = titleEl.textContent?.trim() ?? "";
    if (newTitle !== cell.title) {
      store.updateCell(cell.id, { title: newTitle } as Partial<SectionCell>);
    }
  });
  titleEl.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      titleEl.blur();
    }
  });

  wrap.appendChild(titleEl);
  wrap.appendChild(deleteBtn);
  return wrap;
}
