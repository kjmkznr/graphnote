import type { TypeRegistry, NodeShape } from '../graph/typeRegistry.js';
import { el, clearChildren, byId } from './domUtils.js';
import { isValidIdentifier } from '../utils/graphUtils.js';

export function showNodeTypeStyleDialog(registry: TypeRegistry): Promise<void> {
  return new Promise((resolve) => {
    const overlay = byId('dialog-overlay');
    const dialog = byId('node-type-style-dialog');
    const list = byId('nts-list');
    const newInput = byId<HTMLInputElement>('nts-new-input');
    const addBtn = byId<HTMLButtonElement>('nts-add-btn');
    const closeBtn = byId<HTMLButtonElement>('nts-close-btn');
    const errorEl = el('p', { style: 'color:var(--color-danger,#f87171);font-size:12px;margin:4px 0 0' });
    newInput.insertAdjacentElement('afterend', errorEl);

    function showError(msg: string): void { errorEl.textContent = msg; }
    function clearError(): void { errorEl.textContent = ''; }

    function renderList(): void {
      clearChildren(list);
      for (const type of registry.getAll()) {
        const style = registry.getStyle(type);

        // Type name input
        const nameInput = el('input', { class: 'tm-item-input', value: type, title: 'タイプ名' });
        nameInput.dataset['orig'] = type;
        nameInput.addEventListener('change', () => {
          const orig = nameInput.dataset['orig']!;
          const next = nameInput.value.trim();
          if (!next || next === orig) return;
          if (!isValidIdentifier(next)) {
            nameInput.value = orig;
            showError(`"${next}" は無効です（英数字とアンダースコアのみ使用できます）`);
            return;
          }
          clearError();
          registry.rename(orig, next);
          nameInput.dataset['orig'] = next;
        });

        // Color picker
        const colorInput = el('input', { type: 'color', value: style.color, class: 'ets-color-input', title: '色' });
        colorInput.addEventListener('change', () => {
          const currentType = nameInput.dataset['orig']!;
          const currentStyle = registry.getStyle(currentType);
          registry.setStyle(currentType, { ...currentStyle, color: colorInput.value });
        });

        // Shape select
        const shapeSelect = el('select', { class: 'ets-line-select', title: '形' });
        const shapeOptions: { value: NodeShape; label: string }[] = [
          { value: 'ellipse', label: '円形' },
          { value: 'rectangle', label: '四角形' },
          { value: 'round-rectangle', label: '角丸四角形' },
          { value: 'diamond', label: 'ひし形' },
          { value: 'triangle', label: '三角形' },
          { value: 'hexagon', label: '六角形' },
          { value: 'star', label: '星形' },
        ];
        for (const opt of shapeOptions) {
          const option = el('option', { value: opt.value }, opt.label);
          if (opt.value === style.shape) option.selected = true;
          shapeSelect.appendChild(option);
        }
        shapeSelect.addEventListener('change', () => {
          const currentType = nameInput.dataset['orig']!;
          const currentStyle = registry.getStyle(currentType);
          registry.setStyle(currentType, { ...currentStyle, shape: shapeSelect.value as NodeShape });
        });

        // Delete button
        const deleteBtn = el('button', { class: 'tm-delete-btn', title: '削除' }, '✕');
        deleteBtn.addEventListener('click', () => {
          registry.remove(type);
          renderList();
        });

        list.appendChild(el('div', { class: 'ets-item' }, nameInput, colorInput, shapeSelect, deleteBtn));
      }
    }

    renderList();
    newInput.value = '';
    overlay.style.display = 'flex';
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
