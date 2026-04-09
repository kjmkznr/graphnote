import type { TypeRegistry } from '../graph/typeRegistry.js';
import { el, clearChildren } from './domUtils.js';
import { isValidIdentifier } from '../utils/graphUtils.js';

export function showTypeManagerDialog(registry: TypeRegistry): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('dialog-overlay')!;
    const dialog = document.getElementById('type-manager-dialog')!;
    const list = document.getElementById('tm-list')!;
    const newInput = document.getElementById('tm-new-input') as HTMLInputElement;
    const addBtn = document.getElementById('tm-add-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('tm-close-btn') as HTMLButtonElement;

    const errorEl = el('p', { style: 'color:var(--color-danger,#f87171);font-size:12px;margin:4px 0 0' });
    newInput.insertAdjacentElement('afterend', errorEl);

    function showError(msg: string): void { errorEl.textContent = msg; }
    function clearError(): void { errorEl.textContent = ''; }

    function renderList(): void {
      clearChildren(list);
      for (const t of registry.getAll()) {
        const input = el('input', { class: 'tm-item-input', value: t });
        input.dataset['orig'] = t;
        input.addEventListener('change', () => {
          const orig = input.dataset['orig']!;
          const next = input.value.trim();
          if (!next || next === orig) return;
          if (!isValidIdentifier(next)) {
            input.value = orig;
            showError(`"${next}" は無効です（英数字とアンダースコアのみ使用できます）`);
            return;
          }
          clearError();
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
    document.getElementById('create-node-dialog')!.style.display = 'none';
    dialog.style.display = 'flex';
    newInput.focus();

    function onAdd(): void {
      const val = newInput.value.trim();
      if (!val) return;
      if (!isValidIdentifier(val)) {
        showError(`"${val}" は無効です（英数字とアンダースコアのみ、数字始まり不可）`);
        return;
      }
      clearError();
      registry.add(val);
      newInput.value = '';
      renderList();
    }

    function onClose(): void {
      overlay.style.display = 'none';
      dialog.style.display = 'none';
      document.getElementById('create-node-dialog')!.style.display = 'flex';
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
