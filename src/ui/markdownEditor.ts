import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { el } from './domUtils.js';

/**
 * Markdown テキストを HTML にレンダリングして指定要素の innerHTML に設定する。
 */
export function renderMarkdownContent(element: HTMLElement, markdown: string): void {
  element.innerHTML = DOMPurify.sanitize(marked.parse(markdown) as string);
}

export interface MarkdownEditorOptions {
  textareaClass?: string;
  previewClass?: string;
  placeholder?: string;
}

export interface MarkdownEditorResult {
  textarea: HTMLTextAreaElement;
  preview: HTMLElement;
}

/**
 * Markdown エディタ（textarea）とプレビュー（div）のペアを生成するユーティリティ。
 * コンテンツがあれば初期状態はプレビュー表示、なければエディタ表示。
 * Cmd+Enter または blur でプレビューに切り替え、プレビュークリックでエディタに戻る。
 */
export function makeMarkdownEditor(
  initialContent: string,
  onSave: (value: string, immediate?: boolean) => void,
  options: MarkdownEditorOptions = {},
): MarkdownEditorResult {
  const previewClass = options.previewClass ?? 'nb-markdown-preview';
  const preview = el('div', { class: previewClass });
  const textarea = el('textarea', {
    class: options.textareaClass ?? '',
    placeholder: options.placeholder ?? '',
  }) as HTMLTextAreaElement;
  textarea.value = initialContent;

  const updatePreview = (): void => {
    preview.innerHTML = DOMPurify.sanitize(marked.parse(textarea.value) as string);
  };
  updatePreview();

  const showPreview = (): void => {
    textarea.classList.add('nb-hidden');
    preview.classList.remove('nb-hidden');
  };
  const showEditor = (): void => {
    preview.classList.add('nb-hidden');
    textarea.classList.remove('nb-hidden');
    textarea.focus();
  };

  if (initialContent) {
    showPreview();
  } else {
    preview.classList.add('nb-hidden');
  }

  textarea.addEventListener('input', () => {
    onSave(textarea.value, true);
    updatePreview();
  });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      if (textarea.value) showPreview();
    }
  });
  textarea.addEventListener('blur', () => {
    onSave(textarea.value);
    if (textarea.value) showPreview();
  });
  preview.addEventListener('click', () => {
    showEditor();
  });

  return { textarea, preview };
}
