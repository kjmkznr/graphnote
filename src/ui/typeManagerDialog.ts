import type { TypeRegistry } from '../graph/typeRegistry.js';
import { el, clearChildren, byId } from './domUtils.js';

export function showTypeManagerDialog(registry: TypeRegistry): Promise<void> {
  return new Promise((resolve) => {
    const overlay = byId('dialog-overlay');
    const dialog = byId('type-manager-dialog');
    const list = byId('tm-list');
    const newInput = byId<HTMLInputElement>('tm-new-input');
    const addBtn = byId<HTMLButtonElement>('tm-add-btn');
    const closeBtn = byId<HTMLButtonElement>('tm-close-btn');

    function renderList(): void {
      clearChildren(list);
      for (const t of registry.getAll()) {
        const input = el('input', { class: 'tm-item-input', value: t });
        input.dataset['orig'] = t;
        input.addEventListener('change', () => {
          const orig = input.dataset['orig']!;
          const next = input.value.trim();
          if (!next || next === orig) return;
          registry.rename(orig, next);
          input.dataset['orig'] = next;
        });

        const deleteBtn = el('button', { class: 'tm-delete-btn', title: '削除' }, '✕');
        deleteBtn.addEventListener('click', () => {
          registry.remove(t);
          renderList();
        });

        list.appendChild(el('div', { class: 'tm-item', 'data-type': t }, input, deleteBtn));
      }
    }

    renderList();
    newInput.value = '';
    overlay.style.display = 'flex';

    // Show type manager, hide create-node dialog
    byId('create-node-dialog').style.display = 'none';
    dialog.style.display = 'flex';
    newInput.focus();

    function onAdd(): void {
      const val = newInput.value.trim();
      if (!val) return;
      registry.add(val);
      newInput.value = '';
      renderList();
    }

    function onClose(): void {
      overlay.style.display = 'none';
      dialog.style.display = 'none';
      byId('create-node-dialog').style.display = 'flex';
      addBtn.removeEventListener('click', onAdd);
      closeBtn.removeEventListener('click', onClose);
      overlay.removeEventListener('click', onOverlayClick);
      dialog.removeEventListener('keydown', onKeydown);
      resolve();
    }

    function onOverlayClick(e: MouseEvent): void {
      if (e.target === overlay) onClose();
    }

    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }

    addBtn.addEventListener('click', onAdd);
    closeBtn.addEventListener('click', onClose);
    overlay.addEventListener('click', onOverlayClick);
    dialog.addEventListener('keydown', onKeydown);

    newInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
    });
  });
}
