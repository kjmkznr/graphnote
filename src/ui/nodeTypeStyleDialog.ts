import type { TypeRegistry } from '../graph/typeRegistry.js';
import { byId } from './domUtils.js';
import { createTypeStyleDialogBase, renderStyleList } from './typeStyleDialogBase.js';

export function showNodeTypeStyleDialog(registry: TypeRegistry): Promise<void> {
  const list = byId('nts-list');
  return createTypeStyleDialogBase(registry, {
    dialogId: 'node-type-style-dialog',
    listId: 'nts-list',
    newInputId: 'nts-new-input',
    addBtnId: 'nts-add-btn',
    closeBtnId: 'nts-close-btn',
    renderList: (showError, clearError) => renderStyleList(list, registry, {
      title: '形',
      options: [
        { value: 'ellipse', label: '円形' },
        { value: 'rectangle', label: '四角形' },
        { value: 'round-rectangle', label: '角丸四角形' },
        { value: 'diamond', label: 'ひし形' },
        { value: 'triangle', label: '三角形' },
        { value: 'hexagon', label: '六角形' },
        { value: 'star', label: '星形' },
      ],
      getValue: (style) => style.shape,
      styleKey: 'shape',
    }, showError, clearError),
  });
}
