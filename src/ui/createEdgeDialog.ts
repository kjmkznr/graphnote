import type { EdgeTypeRegistry } from "../graph/edgeTypeRegistry.js";
import { el, clearChildren, byId } from "./domUtils.js";
import { DOM_IDS } from "./domIds.js";
export function showCreateEdgeDialog(
  registry: EdgeTypeRegistry,
): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = byId(DOM_IDS.dialogOverlay);
    const createNodeDialog = byId(DOM_IDS.createNodeDialog);
    const dialog = byId(DOM_IDS.createEdgeDialog);
    const typeSelect = byId<HTMLSelectElement>(DOM_IDS.cedType);
    const newTypeInput = byId<HTMLInputElement>(DOM_IDS.cedNewType);
    const addTypeBtn = byId<HTMLButtonElement>(DOM_IDS.cedAddTypeBtn);
    const confirmBtn = byId<HTMLButtonElement>(DOM_IDS.cedConfirm);
    const cancelBtn = byId<HTMLButtonElement>(DOM_IDS.cedCancel);

    function populateSelect(): void {
      const current = typeSelect.value;
      clearChildren(typeSelect);
      for (const t of registry.getAll()) {
        typeSelect.appendChild(el("option", { value: t }, t));
      }
      if (current && registry.getAll().includes(current)) {
        typeSelect.value = current;
      }
    }

    populateSelect();
    newTypeInput.value = "";
    createNodeDialog.style.display = "none";
    dialog.style.display = "flex";
    overlay.style.display = "flex";
    typeSelect.focus();

    function close(result: string | null): void {
      overlay.style.display = "none";
      dialog.style.display = "none";
      createNodeDialog.style.display = "";
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      addTypeBtn.removeEventListener("click", onAddType);
      overlay.removeEventListener("click", onOverlayClick);
      dialog.removeEventListener("keydown", onKeydown);
      resolve(result);
    }

    function onAddType(): void {
      const newType = newTypeInput.value.trim();
      if (!newType) return;
      registry.add(newType);
      populateSelect();
      typeSelect.value = newType;
      newTypeInput.value = "";
      typeSelect.focus();
    }

    function onConfirm(): void {
      const type = typeSelect.value.trim();
      if (!type) return;
      close(type);
    }
    function onCancel(): void {
      close(null);
    }
    function onOverlayClick(e: MouseEvent): void {
      if (e.target === overlay) close(null);
    }
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === "Enter") {
        e.preventDefault();
        if (document.activeElement === newTypeInput) {
          onAddType();
        } else {
          onConfirm();
        }
      }
      if (e.key === "Escape") close(null);
    }
    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    addTypeBtn.addEventListener("click", onAddType);
    overlay.addEventListener("click", onOverlayClick);
    dialog.addEventListener("keydown", onKeydown);
  });
}
