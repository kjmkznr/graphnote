import type { EdgeTypeRegistry } from '../graph/edgeTypeRegistry.js';
import { byId } from './domUtils.js';
import { createTypeStyleDialogBase, renderStyleList } from './typeStyleDialogBase.js';

export function showEdgeTypeStyleDialog(edgeRegistry: EdgeTypeRegistry): Promise<void> {
  const list = byId('ets-list');
  return createTypeStyleDialogBase(edgeRegistry, {
    dialogId: 'edge-type-style-dialog',
    listId: 'ets-list',
    newInputId: 'ets-new-input',
    addBtnId: 'ets-add-btn',
    closeBtnId: 'ets-close-btn',
    renderList: (showError, clearError) => renderStyleList(list, edgeRegistry, {
      title: '線種',
      options: [
        { value: 'solid', label: '実線' },
        { value: 'dashed', label: '破線' },
        { value: 'dotted', label: '点線' },
      ],
      getValue: (style) => style.lineStyle,
      styleKey: 'lineStyle',
    }, showError, clearError),
  });
}
