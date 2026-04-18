import type { EdgeTypeRegistry } from '../graph/edgeTypeRegistry.js';
import { byId } from './domUtils.js';
import { DOM_IDS } from './domIds.js';
import { createTypeStyleDialogBase, renderStyleList } from './typeStyleDialogBase.js';

export function showEdgeTypeStyleDialog(edgeRegistry: EdgeTypeRegistry): Promise<void> {
  const list = byId(DOM_IDS.etsList);
  return createTypeStyleDialogBase(edgeRegistry, {
    dialogId: DOM_IDS.edgeTypeStyleDialog,
    listId: DOM_IDS.etsList,
    newInputId: DOM_IDS.etsNewInput,
    addBtnId: DOM_IDS.etsAddBtn,
    closeBtnId: DOM_IDS.etsCloseBtn,
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
