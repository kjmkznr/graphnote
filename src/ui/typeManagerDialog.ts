import type { TypeRegistry } from '../graph/typeRegistry.js';

export function showTypeManagerDialog(registry: TypeRegistry): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('dialog-overlay')!;
    const dialog = document.getElementById('type-manager-dialog')!;
    const list = document.getElementById('tm-list')!;
    const newInput = document.getElementById('tm-new-input') as HTMLInputElement;
    const addBtn = document.getElementById('tm-add-btn') as HTMLButtonElement;
    const closeBtn = document.getElementById('tm-close-btn') as HTMLButtonElement;

    function renderList(): void {
      list.innerHTML = registry.getAll().map((t) => `
        <div class="tm-item" data-type="${t}">
          <input class="tm-item-input" value="${t}" data-orig="${t}" />
          <button class="tm-delete-btn" data-type="${t}" title="削除">✕</button>
        </div>
      `).join('');

      list.querySelectorAll<HTMLInputElement>('.tm-item-input').forEach((input) => {
        input.addEventListener('change', () => {
          const orig = input.dataset['orig']!;
          const next = input.value.trim();
          if (!next || next === orig) return;
          registry.rename(orig, next);
          input.dataset['orig'] = next;
        });
      });

      list.querySelectorAll<HTMLButtonElement>('.tm-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          registry.remove(btn.dataset['type']!);
          renderList();
        });
      });
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
