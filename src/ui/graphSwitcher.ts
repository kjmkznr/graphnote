import type { GraphManager } from '../graph/graphManager.js';
import type { GraphMeta } from '../graph/persistence.js';
import { DOM_IDS } from './domIds.js';
import { showToast } from './toast.js';

export type OnGraphSwitch = (id: string) => Promise<void>;

/**
 * ヘッダーのグラフ切替ドロップダウンUIを管理するクラス。
 */
export class GraphSwitcher {
  private manager: GraphManager;
  private onSwitch: OnGraphSwitch;
  private select: HTMLSelectElement;
  private renameBtn: HTMLButtonElement;
  private newBtn: HTMLButtonElement;
  private deleteBtn: HTMLButtonElement;

  constructor(manager: GraphManager, onSwitch: OnGraphSwitch) {
    this.manager = manager;
    this.onSwitch = onSwitch;

    this.select = document.getElementById(DOM_IDS.graphSelect) as HTMLSelectElement;
    this.renameBtn = document.getElementById(DOM_IDS.graphRenameBtn) as HTMLButtonElement;
    this.newBtn = document.getElementById(DOM_IDS.graphNewBtn) as HTMLButtonElement;
    this.deleteBtn = document.getElementById(DOM_IDS.graphDeleteBtn) as HTMLButtonElement;

    this.setup();
  }

  private renameInput: HTMLInputElement | null = null;

  private setup(): void {
    this.select.addEventListener('change', () => {
      void this.handleSwitch(this.select.value);
    });

    this.newBtn.addEventListener('click', () => {
      void this.handleCreate();
    });

    this.renameBtn.addEventListener('click', () => {
      this.startInlineRename();
    });

    this.select.addEventListener('dblclick', () => {
      this.startInlineRename();
    });

    this.deleteBtn.addEventListener('click', () => {
      void this.handleDelete();
    });

    this.render();
  }

  render(): void {
    const graphs = this.manager.graphs;
    const currentId = this.manager.currentGraphId;

    this.select.innerHTML = '';
    for (const g of graphs) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      if (g.id === currentId) opt.selected = true;
      this.select.appendChild(opt);
    }

    this.deleteBtn.disabled = graphs.length <= 1;
  }

  private async handleSwitch(id: string): Promise<void> {
    if (id === this.manager.currentGraphId) return;
    try {
      await this.onSwitch(id);
      this.render();
    } catch (err) {
      showToast(`グラフの切替に失敗しました: ${String(err)}`);
    }
  }

  private async handleCreate(): Promise<void> {
    const name = window.prompt('新しいグラフの名前を入力してください', '新しいグラフ');
    if (name === null) return;
    try {
      const meta: GraphMeta = await this.manager.createGraph(name);
      this.render();
      await this.onSwitch(meta.id);
      this.render();
      showToast(`グラフ「${meta.name}」を作成しました`, 'success');
    } catch (err) {
      showToast(`グラフの作成に失敗しました: ${String(err)}`);
    }
  }

  private startInlineRename(): void {
    if (this.renameInput) return; // already editing
    const current = this.manager.currentGraph;
    if (!current) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = current.name;
    input.className = 'graph-rename-input';
    input.setAttribute('aria-label', 'グラフ名を編集');

    this.select.style.display = 'none';
    this.select.parentElement?.insertBefore(input, this.select);
    this.renameInput = input;

    input.focus();
    input.select();

    const finish = (save: boolean): void => {
      if (!this.renameInput) return;
      const newName = input.value.trim();
      this.renameInput.remove();
      this.renameInput = null;
      this.select.style.display = '';

      if (save && newName && newName !== current.name) {
        void this.commitRename(current.id, newName);
      }
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener('blur', () => {
      finish(true);
    });
  }

  private async commitRename(id: string, newName: string): Promise<void> {
    try {
      await this.manager.renameGraph(id, newName);
      this.render();
      showToast(`グラフ名を「${newName}」に変更しました`, 'success');
    } catch (err) {
      showToast(`グラフ名の変更に失敗しました: ${String(err)}`);
    }
  }

  private async handleDelete(): Promise<void> {
    const current = this.manager.currentGraph;
    if (!current) return;
    if (!window.confirm(`グラフ「${current.name}」を削除しますか？この操作は元に戻せません。`))
      return;
    try {
      const graphs = this.manager.graphs;
      const nextGraph = graphs.find((g) => g.id !== current.id);
      await this.manager.deleteGraph(current.id);
      if (nextGraph) {
        await this.onSwitch(nextGraph.id);
      }
      this.render();
      showToast(`グラフ「${current.name}」を削除しました`, 'success');
    } catch (err) {
      showToast(`グラフの削除に失敗しました: ${String(err)}`);
    }
  }
}
