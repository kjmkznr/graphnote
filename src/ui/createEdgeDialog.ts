import { isValidIdentifier } from '../utils/graphUtils.js';

const DEFAULT_TYPE = 'RELATES_TO';

export function showCreateEdgeDialog(): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('dialog-overlay')!;
    const createNodeDialog = document.getElementById('create-node-dialog')!;
    const dialog = document.getElementById('create-edge-dialog')!;
    const typeInput = document.getElementById('ced-type') as HTMLInputElement;
    const confirmBtn = document.getElementById('ced-confirm') as HTMLButtonElement;
    const cancelBtn = document.getElementById('ced-cancel') as HTMLButtonElement;

    typeInput.value = DEFAULT_TYPE;

    const errorEl = document.createElement('p');
    errorEl.style.cssText = 'color:var(--color-danger,#f87171);font-size:12px;margin:4px 0 0';
    typeInput.insertAdjacentElement('afterend', errorEl);

    createNodeDialog.style.display = 'none';
    dialog.style.display = '';
    overlay.style.display = 'flex';
    typeInput.focus();
    typeInput.select();

    function close(result: string | null): void {
      errorEl.remove();
      overlay.style.display = 'none';
      dialog.style.display = 'none';
      createNodeDialog.style.display = '';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      dialog.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onConfirm(): void {
      const type = typeInput.value.trim();
      if (!type) return;
      if (!isValidIdentifier(type)) {
        errorEl.textContent = `"${type}" は無効です（英数字とアンダースコアのみ、数字始まり不可）`;
        return;
      }
      close(type);
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
