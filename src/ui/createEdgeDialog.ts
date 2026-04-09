import { byId } from './domUtils.js';

const DEFAULT_TYPE = 'RELATES_TO';

export function showCreateEdgeDialog(): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = byId('dialog-overlay');
    const createNodeDialog = byId('create-node-dialog');
    const dialog = byId('create-edge-dialog');
    const typeInput = byId<HTMLInputElement>('ced-type');
    const confirmBtn = byId<HTMLButtonElement>('ced-confirm');
    const cancelBtn = byId<HTMLButtonElement>('ced-cancel');

    typeInput.value = DEFAULT_TYPE;

    createNodeDialog.style.display = 'none';
    dialog.style.display = '';
    overlay.style.display = 'flex';
    typeInput.focus();
    typeInput.select();

    function close(result: string | null): void {
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
