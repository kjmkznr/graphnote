import { isValidIdentifier } from '../utils/graphUtils.js';
import { DOM_IDS } from './domIds.js';
import { byId, clearChildren, el } from './domUtils.js';

export interface TypeStyleRegistry {
  getAll(): string[];
  add(type: string): void;
  rename(orig: string, next: string): void;
  remove(type: string): void;
}

export interface StyleListRegistry<TStyle> extends TypeStyleRegistry {
  getStyle(type: string): TStyle;
  setStyle(type: string, style: TStyle): void;
}

export interface StyleSelectConfig<TStyle> {
  title: string;
  options: { value: string; label: string }[];
  getValue: (style: TStyle) => string;
  styleKey: keyof TStyle;
}

export function renderStyleList<TStyle extends { color: string }>(
  list: HTMLElement,
  registry: StyleListRegistry<TStyle>,
  selectConfig: StyleSelectConfig<TStyle>,
  showError: (msg: string) => void,
  clearError: () => void,
): void {
  clearChildren(list);
  for (const type of registry.getAll()) {
    const style = registry.getStyle(type);

    const nameInput = el('input', {
      class: 'tm-item-input',
      value: type,
      title: 'タイプ名',
    });
    nameInput.dataset.orig = type;
    nameInput.addEventListener('change', () => {
      const orig = nameInput.dataset.orig ?? '';
      const next = nameInput.value.trim();
      if (!next || next === orig) return;
      if (!isValidIdentifier(next)) {
        nameInput.value = orig;
        showError(`"${next}" は無効です（英数字とアンダースコアのみ使用できます）`);
        return;
      }
      clearError();
      registry.rename(orig, next);
      nameInput.dataset.orig = next;
    });

    const colorInput = el('input', {
      type: 'color',
      value: style.color,
      class: 'ets-color-input',
      title: '色',
    });
    colorInput.addEventListener('change', () => {
      const currentType = nameInput.dataset.orig ?? '';
      const currentStyle = registry.getStyle(currentType);
      registry.setStyle(currentType, {
        ...currentStyle,
        color: colorInput.value,
      });
    });

    const styleSelect = el('select', {
      class: 'ets-line-select',
      title: selectConfig.title,
    });
    for (const opt of selectConfig.options) {
      const option = el('option', { value: opt.value }, opt.label);
      if (opt.value === selectConfig.getValue(style)) option.selected = true;
      styleSelect.appendChild(option);
    }
    styleSelect.addEventListener('change', () => {
      const currentType = nameInput.dataset.orig ?? '';
      const currentStyle = registry.getStyle(currentType);
      registry.setStyle(currentType, {
        ...currentStyle,
        [selectConfig.styleKey]: styleSelect.value,
      } as TStyle);
    });

    const deleteBtn = el('button', { class: 'tm-delete-btn', title: '削除' }, '✕');
    deleteBtn.addEventListener('click', () => {
      registry.remove(type);
      renderStyleList(list, registry, selectConfig, showError, clearError);
    });

    list.appendChild(
      el('div', { class: 'ets-item' }, nameInput, colorInput, styleSelect, deleteBtn),
    );
  }
}

export interface TypeStyleDialogOptions {
  dialogId: string;
  listId: string;
  newInputId: string;
  addBtnId: string;
  closeBtnId: string;
  renderList: (showError: (msg: string) => void, clearError: () => void) => void;
}

export function createTypeStyleDialogBase(
  registry: TypeStyleRegistry,
  opts: TypeStyleDialogOptions,
): Promise<void> {
  return new Promise((resolve) => {
    const overlay = byId(DOM_IDS.dialogOverlay);
    const dialog = byId(opts.dialogId);
    const newInput = byId<HTMLInputElement>(opts.newInputId);
    const addBtn = byId<HTMLButtonElement>(opts.addBtnId);
    const closeBtn = byId<HTMLButtonElement>(opts.closeBtnId);
    const errorEl = el('p', {
      style: 'color:var(--color-danger,#f87171);font-size:12px;margin:4px 0 0',
    });
    newInput.insertAdjacentElement('afterend', errorEl);

    function showError(msg: string): void {
      errorEl.textContent = msg;
    }
    function clearError(): void {
      errorEl.textContent = '';
    }

    opts.renderList(showError, clearError);
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
      opts.renderList(showError, clearError);
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
      if (e.key === 'Enter') {
        e.preventDefault();
        onAdd();
      }
    });
  });
}
