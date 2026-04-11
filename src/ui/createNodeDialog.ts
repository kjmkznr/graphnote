import type { TypeRegistry } from '../graph/typeRegistry.js';
import { el, clearChildren, byId } from './domUtils.js';

export interface CreateNodeResult {
  type: string;
  name: string;
}

export function showCreateNodeDialog(registry: TypeRegistry): Promise<CreateNodeResult | null> {
  return new Promise((resolve) => {
    const overlay = byId('dialog-overlay');
    const dialog = byId('create-node-dialog');
    const typeSelect = byId<HTMLSelectElement>('cnd-type');
    const nameInput = byId<HTMLInputElement>('cnd-name');
    const confirmBtn = byId<HTMLButtonElement>('cnd-confirm');
    const cancelBtn = byId<HTMLButtonElement>('cnd-cancel');

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

    function onCancel(): void { close(null); }

    function onOverlayClick(e: MouseEvent): void {
      if (e.target === overlay) close(null);
    }

    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
      if (e.key === 'Escape') close(null);
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    dialog.addEventListener('keydown', onKeydown);
  });
}
