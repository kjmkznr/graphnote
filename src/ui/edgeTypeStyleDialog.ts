import type { EdgeTypeRegistry, LineStyle } from '../graph/edgeTypeRegistry.js';
import { el, clearChildren, byId } from './domUtils.js';
import { isValidIdentifier } from '../utils/graphUtils.js';
import { createTypeStyleDialogBase } from './typeStyleDialogBase.js';

export function showEdgeTypeStyleDialog(edgeRegistry: EdgeTypeRegistry): Promise<void> {
  const list = byId('ets-list');

  function renderList(showError: (msg: string) => void, clearError: () => void): void {
    clearChildren(list);
    for (const type of edgeRegistry.getAll()) {
      const style = edgeRegistry.getStyle(type);

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
        edgeRegistry.rename(orig, next);
        nameInput.dataset['orig'] = next;
      });

      // Color picker
      const colorInput = el('input', { type: 'color', value: style.color, class: 'ets-color-input', title: '色' });
      colorInput.addEventListener('change', () => {
        const currentType = nameInput.dataset['orig']!;
        const currentStyle = edgeRegistry.getStyle(currentType);
        edgeRegistry.setStyle(currentType, { ...currentStyle, color: colorInput.value });
      });

      // Line style select
      const lineSelect = el('select', { class: 'ets-line-select', title: '線種' });
      const lineOptions: { value: LineStyle; label: string }[] = [
        { value: 'solid', label: '実線' },
        { value: 'dashed', label: '破線' },
        { value: 'dotted', label: '点線' },
      ];
      for (const opt of lineOptions) {
        const option = el('option', { value: opt.value }, opt.label);
        if (opt.value === style.lineStyle) option.selected = true;
        lineSelect.appendChild(option);
      }
      lineSelect.addEventListener('change', () => {
        const currentType = nameInput.dataset['orig']!;
        const currentStyle = edgeRegistry.getStyle(currentType);
        edgeRegistry.setStyle(currentType, { ...currentStyle, lineStyle: lineSelect.value as LineStyle });
      });

      // Delete button
      const deleteBtn = el('button', { class: 'tm-delete-btn', title: '削除' }, '✕');
      deleteBtn.addEventListener('click', () => {
        edgeRegistry.remove(type);
        renderList(showError, clearError);
      });

      list.appendChild(el('div', { class: 'ets-item' }, nameInput, colorInput, lineSelect, deleteBtn));
    }
  }

  return createTypeStyleDialogBase(edgeRegistry, {
    dialogId: 'edge-type-style-dialog',
    listId: 'ets-list',
    newInputId: 'ets-new-input',
    addBtnId: 'ets-add-btn',
    closeBtnId: 'ets-close-btn',
    renderList,
  });
}
