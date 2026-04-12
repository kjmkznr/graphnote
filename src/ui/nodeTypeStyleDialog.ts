import type { TypeRegistry, NodeShape } from '../graph/typeRegistry.js';
import { el, clearChildren, byId } from './domUtils.js';
import { isValidIdentifier } from '../utils/graphUtils.js';
import { createTypeStyleDialogBase } from './typeStyleDialogBase.js';

export function showNodeTypeStyleDialog(registry: TypeRegistry): Promise<void> {
  const list = byId('nts-list');

  function renderList(showError: (msg: string) => void, clearError: () => void): void {
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
        renderList(showError, clearError);
      });

      list.appendChild(el('div', { class: 'ets-item' }, nameInput, colorInput, shapeSelect, deleteBtn));
    }
  }

  return createTypeStyleDialogBase(registry, {
    dialogId: 'node-type-style-dialog',
    listId: 'nts-list',
    newInputId: 'nts-new-input',
    addBtnId: 'nts-add-btn',
    closeBtnId: 'nts-close-btn',
    renderList,
  });
}
