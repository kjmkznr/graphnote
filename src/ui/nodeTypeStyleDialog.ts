import type { TypeRegistry } from "../graph/typeRegistry.js";
import { byId } from "./domUtils.js";
import { DOM_IDS } from "./domIds.js";
import {
  createTypeStyleDialogBase,
  renderStyleList,
} from "./typeStyleDialogBase.js";

export function showNodeTypeStyleDialog(registry: TypeRegistry): Promise<void> {
  const list = byId(DOM_IDS.ntsList);
  return createTypeStyleDialogBase(registry, {
    dialogId: DOM_IDS.nodeTypeStyleDialog,
    listId: DOM_IDS.ntsList,
    newInputId: DOM_IDS.ntsNewInput,
    addBtnId: DOM_IDS.ntsAddBtn,
    closeBtnId: DOM_IDS.ntsCloseBtn,
    renderList: (showError, clearError) =>
      renderStyleList(
        list,
        registry,
        {
          title: "形",
          options: [
            { value: "ellipse", label: "円形" },
            { value: "rectangle", label: "四角形" },
            { value: "round-rectangle", label: "角丸四角形" },
            { value: "diamond", label: "ひし形" },
            { value: "triangle", label: "三角形" },
            { value: "hexagon", label: "六角形" },
            { value: "star", label: "星形" },
          ],
          getValue: (style) => style.shape,
          styleKey: "shape",
        },
        showError,
        clearError,
      ),
  });
}
