import type { GnId, RawNode, RawEdge, PropertyValue } from '../types.js';
import type { TypeRegistry } from '../graph/typeRegistry.js';

// Properties that are internal and should never be shown to the user
const HIDDEN_PROPS = new Set(['gnId', 'note']);

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class Sidebar {
  private registry!: TypeRegistry;
  private elHeader = document.getElementById('element-header')!;
  private elEmpty = document.getElementById('sidebar-empty')!;
  private elContent = document.getElementById('sidebar-content')!;
  private elPropsList = document.getElementById('properties-list')!;
  private elNoteTextarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
  private elNewPropKey = document.getElementById('new-prop-key') as HTMLInputElement;
  private elNewPropVal = document.getElementById('new-prop-val') as HTMLInputElement;
  private elAddPropBtn = document.getElementById('add-prop-btn')!;

  private currentGnId: GnId | null = null;
  private currentType: 'node' | 'edge' | null = null;
  private currentLabel: string | null = null;

  private onNoteChangeCb: ((gnId: GnId, note: string) => void) | null = null;
  private onPropertyChangeCb: ((gnId: GnId, key: string, value: PropertyValue) => void) | null = null;
  private onAddPropertyCb: ((gnId: GnId, key: string, value: string) => void) | null = null;
  private onLabelChangeCb: ((gnId: GnId, oldLabel: string, newLabel: string) => void) | null = null;

  setRegistry(registry: TypeRegistry): void {
    this.registry = registry;
  }

  constructor() {
    this.elNoteTextarea.addEventListener('input', () => {
      if (!this.currentGnId || !this.onNoteChangeCb) return;
      this.onNoteChangeCb(this.currentGnId, this.elNoteTextarea.value);
    });

    this.elAddPropBtn.addEventListener('click', () => {
      const key = this.elNewPropKey.value.trim();
      const val = this.elNewPropVal.value.trim();
      if (!key || !this.currentGnId) return;
      this.onAddPropertyCb?.(this.currentGnId, key, val);
      this.elNewPropKey.value = '';
      this.elNewPropVal.value = '';
    });

    this.elNewPropKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.elNewPropVal.focus();
    });
    this.elNewPropVal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.elAddPropBtn.click();
    });
  }

  showNode(node: RawNode): void {
    this.currentGnId = node._properties['gnId'] as GnId ?? null;
    this.currentType = 'node';
    this.currentLabel = node._labels[0] ?? 'Node';

    this.renderNodeHeader(this.currentLabel);
    this.renderProps(node._properties);
    this.elNoteTextarea.value = (node._properties['note'] as string | undefined) ?? '';
    this.showContent();
  }

  showEdge(edge: RawEdge): void {
    this.currentGnId = edge._properties['gnId'] as GnId ?? null;
    this.currentType = 'edge';
    this.currentLabel = null;

    this.elHeader.innerHTML = `
      <div class="element-type-badge badge-edge">Edge</div>
      <div class="element-title">${escHtml(edge._type)}</div>
    `;

    this.renderProps(edge._properties);
    this.elNoteTextarea.value = (edge._properties['note'] as string | undefined) ?? '';
    this.showContent();
  }

  hide(): void {
    this.currentGnId = null;
    this.currentType = null;
    this.currentLabel = null;
    this.elEmpty.style.display = '';
    this.elContent.style.display = 'none';
  }

  onNoteChange(cb: (gnId: GnId, note: string) => void): void { this.onNoteChangeCb = cb; }
  onPropertyChange(cb: (gnId: GnId, key: string, value: PropertyValue) => void): void { this.onPropertyChangeCb = cb; }
  onAddProperty(cb: (gnId: GnId, key: string, value: string) => void): void { this.onAddPropertyCb = cb; }
  onLabelChange(cb: (gnId: GnId, oldLabel: string, newLabel: string) => void): void { this.onLabelChangeCb = cb; }

  private renderNodeHeader(label: string): void {
    // Ensure current label exists in registry
    this.registry?.ensure(label);

    const types = this.registry?.getAll() ?? [label];
    const options = types.map((t) =>
      `<option value="${escHtml(t)}"${t === label ? ' selected' : ''}>${escHtml(t)}</option>`,
    ).join('');
    // Add current label as option even if not in registry
    const hasLabel = types.includes(label);
    const extraOption = !hasLabel
      ? `<option value="${escHtml(label)}" selected>${escHtml(label)}</option>`
      : '';

    this.elHeader.innerHTML = `
      <div class="element-type-badge badge-node">Node</div>
      <div class="label-row">
        <span class="label-prefix">Type:</span>
        <select id="label-select" class="label-input" title="ノードのタイプ。色分けやフィルタリングに使われます">
          ${extraOption}${options}
        </select>
      </div>
    `;

    const select = document.getElementById('label-select') as HTMLSelectElement;
    select.addEventListener('change', () => {
      const newLabel = select.value;
      if (!newLabel || !this.currentGnId || !this.currentLabel || newLabel === this.currentLabel) return;
      this.onLabelChangeCb?.(this.currentGnId, this.currentLabel, newLabel);
      this.currentLabel = newLabel;
    });
  }

  private showContent(): void {
    this.elEmpty.style.display = 'none';
    this.elContent.style.display = 'flex';
  }

  private renderProps(props: Record<string, PropertyValue>): void {
    const visible = Object.entries(props).filter(([k]) => !HIDDEN_PROPS.has(k));
    this.elPropsList.innerHTML = visible.map(([k, v]) => {
      const strVal = v === null ? '' : String(v);
      const hint = k === 'name' ? ' title="グラフ上に表示される名前"' : '';
      return `
        <div class="prop-row">
          <span class="prop-key"${hint}>${escHtml(k)}</span>
          <input
            class="prop-value-input"
            data-key="${escHtml(k)}"
            value="${escHtml(strVal)}"
          />
        </div>
      `;
    }).join('');

    this.elPropsList.querySelectorAll<HTMLInputElement>('.prop-value-input').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset['key'];
        if (!key || !this.currentGnId) return;
        this.onPropertyChangeCb?.(this.currentGnId, key, input.value);
      });
    });
  }
}
