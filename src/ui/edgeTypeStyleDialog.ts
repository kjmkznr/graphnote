import type { EdgeTypeRegistry, LineStyle } from '../graph/edgeTypeRegistry.js';
import { el, clearChildren, byId } from './domUtils.js';
import { isValidIdentifier } from '../utils/graphUtils.js';

export function showEdgeTypeStyleDialog(edgeRegistry: EdgeTypeRegistry): Promise<void> {
  return new Promise((resolve) => {
    const overlay = byId('dialog-overlay');
    const dialog = byId('edge-type-style-dialog');
    const list = byId('ets-list');
    const newInput = byId<HTMLInputElement>('ets-new-input');
    const addBtn = byId<HTMLButtonElement>('ets-add-btn');
    const closeBtn = byId<HTMLButtonElement>('ets-close-btn');
    const errorEl = el('p', { style: 'color:var(--color-danger,#f87171);font-size:12px;margin:4px 0 0' });
    newInput.insertAdjacentElement('afterend', errorEl);

    function showError(msg: string): void { errorEl.textContent = msg; }
    function clearError(): void { errorEl.textContent = ''; }

    function renderList(): void {
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
          renderList();
        });

        list.appendChild(el('div', { class: 'ets-item' }, nameInput, colorInput, lineSelect, deleteBtn));
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
      edgeRegistry.add(val);
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
