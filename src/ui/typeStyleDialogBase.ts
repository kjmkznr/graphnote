import { el, byId } from './domUtils.js';
import { DOM_IDS } from './domIds.js';
import { isValidIdentifier } from '../utils/graphUtils.js';

export interface TypeStyleRegistry {
  getAll(): string[];
  add(type: string): void;
  rename(orig: string, next: string): void;
  remove(type: string): void;
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
    const errorEl = el('p', { style: 'color:var(--color-danger,#f87171);font-size:12px;margin:4px 0 0' });
    newInput.insertAdjacentElement('afterend', errorEl);

    function showError(msg: string): void { errorEl.textContent = msg; }
    function clearError(): void { errorEl.textContent = ''; }

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
      if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
    });
  });
}
