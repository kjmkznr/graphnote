import type { GnId, RawNode, RawEdge, PropertyValue } from '../types.js';
import type { TypeRegistry } from '../graph/typeRegistry.js';
import { el, clearChildren, byId } from './domUtils.js';
import { renderMarkdownContent } from './markdownEditor.js';
import { createPropertyInput, detectPropertyType, getPropertyTypeBadge } from './propertyInput.js';

// Properties that are internal and should never be shown to the user
const HIDDEN_PROPS = new Set(['gnId', 'note']);

export type SidebarCallbacks = {
  onNoteChange: (gnId: GnId, note: string) => void;
  onPropertyChange: (gnId: GnId, key: string, value: PropertyValue) => void;
  onAddProperty: (gnId: GnId, key: string, value: string) => void;
  onLabelChange: (gnId: GnId, oldLabel: string, newLabel: string) => void;
};

export class Sidebar {
  private registry: TypeRegistry | undefined;
  private elHeader = byId('element-header');
  private elEmpty = byId('sidebar-empty');
  private elContent = byId('sidebar-content');
  private elPropsList = byId('properties-list');
  private elNoteTextarea = byId<HTMLTextAreaElement>('note-textarea');
  private elNotePreview = byId('note-preview');
  private elNewPropKey = byId<HTMLInputElement>('new-prop-key');
  private elNewPropVal = byId<HTMLInputElement>('new-prop-val');
  private elAddPropBtn = byId('add-prop-btn');

  private currentGnId: GnId | null = null;
  private currentType: 'node' | 'edge' | null = null;
  private currentLabel: string | null = null;

  private callbacks: Partial<SidebarCallbacks> = {};

  setRegistry(registry: TypeRegistry): void {
    this.registry = registry;
  }

  constructor() {
    this.elNoteTextarea.addEventListener('input', () => {
      if (!this.currentGnId) return;
      this.callbacks.onNoteChange?.(this.currentGnId, this.elNoteTextarea.value);
      this.updatePreview();
    });

    this.elNoteTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.metaKey) {
        e.preventDefault();
        if (this.elNoteTextarea.value) this.showNotePreview();
      }
    });

    this.elNoteTextarea.addEventListener('blur', () => {
      if (this.elNoteTextarea.value) this.showNotePreview();
    });

    this.elNotePreview.addEventListener('click', () => {
      this.showNoteEditor();
    });

    this.elAddPropBtn.addEventListener('click', () => {
      const key = this.elNewPropKey.value.trim();
      const val = this.elNewPropVal.value.trim();
      if (!key || !this.currentGnId) return;
      this.callbacks.onAddProperty?.(this.currentGnId, key, val);
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
    this.elNoteTextarea.classList.remove('nb-hidden');
    this.elNotePreview.classList.add('nb-hidden');
    if (this.elNoteTextarea.value) this.showNotePreview();
    this.showContent();
  }

  showEdge(edge: RawEdge): void {
    this.currentGnId = edge._properties['gnId'] as GnId ?? null;
    this.currentType = 'edge';
    this.currentLabel = null;

    clearChildren(this.elHeader);
    this.elHeader.appendChild(el('div', { class: 'element-type-badge badge-edge' }, 'Edge'));
    this.elHeader.appendChild(el('div', { class: 'element-title' }, edge._type));

    this.renderProps(edge._properties);
    this.elNoteTextarea.value = (edge._properties['note'] as string | undefined) ?? '';
    this.elNoteTextarea.classList.remove('nb-hidden');
    this.elNotePreview.classList.add('nb-hidden');
    if (this.elNoteTextarea.value) this.showNotePreview();
    this.showContent();
  }

  hide(): void {
    this.currentGnId = null;
    this.currentType = null;
    this.currentLabel = null;
    this.elEmpty.style.display = '';
    this.elContent.style.display = 'none';
  }

  getCurrentType(): 'node' | 'edge' | null { return this.currentType; }

  setCallbacks(cbs: SidebarCallbacks): void { this.callbacks = cbs; }

  private renderNodeHeader(label: string): void {
    this.registry?.ensure(label);
    const types = this.registry?.getAll() ?? [label];

    const select = el('select', {
      id: 'label-select',
      class: 'label-input',
      title: 'ノードのタイプ。色分けやフィルタリングに使われます',
    });

    // Add current label as first option if it's not in the registry
    if (!types.includes(label)) {
      select.appendChild(el('option', { value: label }, label));
    }
    for (const t of types) {
      select.appendChild(el('option', { value: t }, t));
    }
    select.value = label;

    select.addEventListener('change', () => {
      const newLabel = select.value;
      if (!newLabel || !this.currentGnId || !this.currentLabel || newLabel === this.currentLabel) return;
      this.callbacks.onLabelChange?.(this.currentGnId, this.currentLabel, newLabel);
      this.currentLabel = newLabel;
    });

    clearChildren(this.elHeader);
    this.elHeader.appendChild(el('div', { class: 'element-type-badge badge-node' }, 'Node'));
    this.elHeader.appendChild(
      el('div', { class: 'label-row' },
        el('span', { class: 'label-prefix' }, 'Type:'),
        select,
      ),
    );
  }

  private updatePreview(): void {
    renderMarkdownContent(this.elNotePreview, this.elNoteTextarea.value);
  }

  private showNotePreview(): void {
    this.updatePreview();
    this.elNoteTextarea.classList.add('nb-hidden');
    this.elNotePreview.classList.remove('nb-hidden');
  }

  private showNoteEditor(): void {
    this.elNotePreview.classList.add('nb-hidden');
    this.elNoteTextarea.classList.remove('nb-hidden');
    this.elNoteTextarea.focus();
  }

  private showContent(): void {
    this.elEmpty.style.display = 'none';
    this.elContent.style.display = 'flex';
  }

  private renderProps(props: Record<string, PropertyValue>): void {
    const visible = Object.entries(props).filter(([k]) => !HIDDEN_PROPS.has(k));
    clearChildren(this.elPropsList);

    for (const [k, v] of visible) {
      const type = detectPropertyType(k, v);
      const badge = getPropertyTypeBadge(type);

      const keyAttrs: Record<string, string> = { class: 'prop-key' };
      if (k === 'name') keyAttrs['title'] = 'グラフ上に表示される名前';

      const keyEl = el('span', keyAttrs,
        badge ? el('span', { class: 'prop-type-badge', title: type }, badge) : '',
        k,
      );

      const inputWrapper = createPropertyInput({
        key: k,
        value: v,
        onChange: (newVal) => {
          if (!this.currentGnId) return;
          this.callbacks.onPropertyChange?.(this.currentGnId, k, newVal);
        },
      });

      this.elPropsList.appendChild(
        el('div', { class: 'prop-row' }, keyEl, inputWrapper),
      );
    }
  }
}
