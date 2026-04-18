import type { TypeRegistry } from '../graph/typeRegistry.js';
import { DOM_IDS } from './domIds.js';
import { byId, clearChildren, el } from './domUtils.js';

export interface CreateNodeResult {
  type: string;
  name: string;
}

export function showCreateNodeDialog(registry: TypeRegistry): Promise<CreateNodeResult | null> {
  return new Promise((resolve) => {
    const overlay = byId(DOM_IDS.dialogOverlay);
    const dialog = byId(DOM_IDS.createNodeDialog);
    const typeSelect = byId<HTMLSelectElement>(DOM_IDS.cndType);
    const nameInput = byId<HTMLInputElement>(DOM_IDS.cndName);
    const confirmBtn = byId<HTMLButtonElement>(DOM_IDS.cndConfirm);
    const cancelBtn = byId<HTMLButtonElement>(DOM_IDS.cndCancel);

    // Populate type options
    clearChildren(typeSelect);
    for (const t of registry.getAll()) {
      typeSelect.appendChild(el('option', { value: t }, t));
    }

    nameInput.value = '';

    overlay.style.display = 'flex';
    dialog.style.display = 'flex';
    nameInput.focus();

    function close(result: CreateNodeResult | null): void {
      overlay.style.display = 'none';
      dialog.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      dialog.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onConfirm(): void {
      const type = typeSelect.value.trim();
      const name = nameInput.value.trim() || type;
      if (!type) return;
      close({ type, name });
    }

    function onCancel(): void {
      close(null);
    }

    function onOverlayClick(e: MouseEvent): void {
      if (e.target === overlay) close(null);
    }

    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
      if (e.key === 'Escape') close(null);
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    dialog.addEventListener('keydown', onKeydown);
  });
}
