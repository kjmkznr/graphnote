import type { EdgeColumnDef, CsvImportOptions } from '../graph/csvImport.js';
import { parseCsv } from '../graph/csvImport.js';
import { byId, el, clearChildren } from './domUtils.js';
import { isValidIdentifier } from '../utils/graphUtils.js';
import type { TypeRegistry } from '../graph/typeRegistry.js';

/**
 * CSV インポートダイアログを表示し、ユーザーが設定を確定したら
 * { csvText, options } を返す。キャンセル時は null を返す。
 */
export function showCsvImportDialog(registry: TypeRegistry): Promise<{ csvText: string; options: CsvImportOptions } | null> {
  return new Promise((resolve) => {
    const overlay = byId('dialog-overlay');
    const dialog = byId('csv-import-dialog');
    dialog.style.display = 'block';
    overlay.style.display = 'flex';

    const fileInput = byId<HTMLInputElement>('cid-file');
    const nodeLabelInput = byId<HTMLInputElement>('cid-node-label');
    const nodeLabelDatalist = byId<HTMLDataListElement>('cid-node-label-list');

    // 既存ノードタイプを datalist に設定
    clearChildren(nodeLabelDatalist);
    for (const t of registry.getAll()) {
      nodeLabelDatalist.appendChild(el('option', { value: t }));
    }
    const edgeColsContainer = byId('cid-edge-cols');
    const addEdgeColBtn = byId('cid-add-edge-col-btn');
    const cancelBtn = byId('cid-cancel');
    const confirmBtn = byId('cid-confirm');
    const previewEl = byId('cid-preview');

    let csvText = '';
    let headers: string[] = [];

    function renderPreview(): void {
      clearChildren(previewEl);
      if (!csvText) return;
      try {
        const rows = parseCsv(csvText);
        if (rows.length === 0) return;
        const table = el('table', { class: 'csv-preview-table' });
        const thead = el('thead');
        const headerRow = el('tr');
        for (const h of (rows[0] ?? [])) {
          headerRow.appendChild(el('th', {}, h));
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = el('tbody');
        const previewRows = rows.slice(1, 4);
        for (const row of previewRows) {
          const tr = el('tr');
          for (const cell of row) {
            tr.appendChild(el('td', {}, cell));
          }
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        previewEl.appendChild(table);
        if (rows.length > 4) {
          previewEl.appendChild(el('div', { class: 'csv-preview-more' }, `… 他 ${rows.length - 4} 行`));
        }
      } catch {
        previewEl.textContent = 'プレビューの生成に失敗しました';
      }
    }

    function buildHeaderSelect(selectedValue = ''): HTMLSelectElement {
      const select = el('select', { class: 'dialog-select cid-edge-col-select' }) as HTMLSelectElement;
      const emptyOpt = el('option', { value: '' }, '-- 列を選択 --') as HTMLOptionElement;
      select.appendChild(emptyOpt);
      for (const h of headers) {
        const opt = el('option', { value: h }, h) as HTMLOptionElement;
        if (h === selectedValue) opt.selected = true;
        select.appendChild(opt);
      }
      return select;
    }

    function addEdgeColRow(): void {
      const row = el('div', { class: 'cid-edge-col-row' });

      const colSelect = buildHeaderSelect();
      colSelect.title = '関係列（CSV の列名）';

      const typeInput = el('input', {
        class: 'dialog-input cid-edge-type-input',
        placeholder: 'エッジタイプ名',
        title: 'エッジタイプ（例: KNOWS）',
      }) as HTMLInputElement;

      const dirSelect = el('select', { class: 'dialog-select cid-edge-dir-select' }) as HTMLSelectElement;
      const outOpt = el('option', { value: 'out' }, '→ (out)') as HTMLOptionElement;
      const inOpt = el('option', { value: 'in' }, '← (in)') as HTMLOptionElement;
      dirSelect.appendChild(outOpt);
      dirSelect.appendChild(inOpt);

      const removeBtn = el('button', { class: 'dialog-btn dialog-btn-secondary cid-remove-edge-col' }, '✕');
      removeBtn.addEventListener('click', () => row.remove());

      row.appendChild(colSelect);
      row.appendChild(typeInput);
      row.appendChild(dirSelect);
      row.appendChild(removeBtn);
      edgeColsContainer.appendChild(row);
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        csvText = (e.target?.result as string) ?? '';
        try {
          const rows = parseCsv(csvText);
          headers = rows[0] ?? [];
        } catch {
          headers = [];
        }
        // ノードラベルをファイル名から自動設定
        if (!nodeLabelInput.value) {
          const baseName = file.name.replace(/\.csv$/i, '').replace(/[^A-Za-z0-9_]/g, '_');
          nodeLabelInput.value = /^[A-Za-z_]/.test(baseName) ? baseName : `Node_${baseName}`;
        }
        // 既存のエッジ列セレクトを更新
        edgeColsContainer.querySelectorAll<HTMLSelectElement>('.cid-edge-col-select').forEach((sel) => {
          const current = sel.value;
          clearChildren(sel);
          const emptyOpt = el('option', { value: '' }, '-- 列を選択 --') as HTMLOptionElement;
          sel.appendChild(emptyOpt);
          for (const h of headers) {
            const opt = el('option', { value: h }, h) as HTMLOptionElement;
            if (h === current) opt.selected = true;
            sel.appendChild(opt);
          }
        });
        renderPreview();
      };
      reader.readAsText(file);
    });

    addEdgeColBtn.addEventListener('click', () => addEdgeColRow());

    function close(result: { csvText: string; options: CsvImportOptions } | null): void {
      dialog.style.display = 'none';
      overlay.style.display = 'none';
      clearChildren(edgeColsContainer);
      clearChildren(previewEl);
      fileInput.value = '';
      nodeLabelInput.value = '';
      csvText = '';
      headers = [];
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      resolve(result);
    }

    function onCancel(): void {
      close(null);
    }

    function onConfirm(): void {
      if (!csvText) {
        alert('CSVファイルを選択してください');
        return;
      }
      const nodeLabel = nodeLabelInput.value.trim();
      if (!nodeLabel) {
        alert('ノードラベルを入力してください');
        return;
      }
      if (!isValidIdentifier(nodeLabel)) {
        alert(`ノードラベル "${nodeLabel}" はCypher識別子として無効です（英数字とアンダースコアのみ、数字始まり不可）`);
        return;
      }

      const edgeColumns: EdgeColumnDef[] = [];
      const rows = edgeColsContainer.querySelectorAll<HTMLElement>('.cid-edge-col-row');
      for (const row of rows) {
        const colSel = row.querySelector<HTMLSelectElement>('.cid-edge-col-select');
        const typeInp = row.querySelector<HTMLInputElement>('.cid-edge-type-input');
        const dirSel = row.querySelector<HTMLSelectElement>('.cid-edge-dir-select');
        const column = colSel?.value ?? '';
        const edgeType = typeInp?.value.trim() ?? '';
        const direction = (dirSel?.value ?? 'out') as 'out' | 'in';
        if (!column || !edgeType) continue;
        if (!isValidIdentifier(edgeType)) {
          alert(`エッジタイプ "${edgeType}" はCypher識別子として無効です`);
          return;
        }
        edgeColumns.push({ column, edgeType, direction });
      }

      close({ csvText, options: { nodeLabel, edgeColumns } });
    }

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
  });
}
