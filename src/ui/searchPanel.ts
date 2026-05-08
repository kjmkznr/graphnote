import { DOM_IDS } from './domIds.js';
import { byId } from './domUtils.js';

export interface SearchPanelCallbacks {
  onInput: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

/**
 * Search panel UI component that floats over the canvas.
 * Handles display, input, match count, and navigation buttons.
 * Search logic lives in SearchController.
 */
export class SearchPanel {
  private panel: HTMLElement;
  private input: HTMLInputElement;
  private matchCount: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;

  private callbacks: SearchPanelCallbacks | null = null;
  private boundOnInput: (() => void) | null = null;
  private boundOnKeydown: ((e: KeyboardEvent) => void) | null = null;
  private boundOnPrev: (() => void) | null = null;
  private boundOnNext: (() => void) | null = null;
  private boundOnClose: (() => void) | null = null;

  constructor() {
    this.panel = byId(DOM_IDS.searchPanel);
    this.input = byId(DOM_IDS.searchInput) as HTMLInputElement;
    this.matchCount = byId(DOM_IDS.searchMatchCount);
    this.prevBtn = byId(DOM_IDS.searchPrevBtn) as HTMLButtonElement;
    this.nextBtn = byId(DOM_IDS.searchNextBtn) as HTMLButtonElement;
    this.closeBtn = byId(DOM_IDS.searchCloseBtn) as HTMLButtonElement;
  }

  setCallbacks(callbacks: SearchPanelCallbacks): void {
    this.callbacks = callbacks;
    this.bindEvents();
  }

  show(): void {
    this.panel.style.display = 'flex';
    this.focusInput();
  }

  hide(): void {
    this.panel.style.display = 'none';
  }

  isVisible(): boolean {
    return this.panel.style.display !== 'none';
  }

  getInputValue(): string {
    return this.input.value;
  }

  setInputValue(value: string): void {
    this.input.value = value;
  }

  focusInput(): void {
    this.input.focus();
    this.input.select();
  }

  setMatchCount(current: number, total: number): void {
    if (total === 0) {
      this.matchCount.textContent = '0 件';
    } else {
      this.matchCount.textContent = `${current} / ${total}`;
    }
  }

  clearMatchCount(): void {
    this.matchCount.textContent = '';
  }

  private bindEvents(): void {
    this.removeEvents();

    this.boundOnInput = () => {
      this.callbacks?.onInput(this.input.value);
    };
    this.input.addEventListener('input', this.boundOnInput);

    this.boundOnKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.callbacks?.onPrev();
        } else {
          this.callbacks?.onNext();
        }
      }
    };
    this.input.addEventListener('keydown', this.boundOnKeydown);

    this.boundOnPrev = () => this.callbacks?.onPrev();
    this.prevBtn.addEventListener('click', this.boundOnPrev);

    this.boundOnNext = () => this.callbacks?.onNext();
    this.nextBtn.addEventListener('click', this.boundOnNext);

    this.boundOnClose = () => this.callbacks?.onClose();
    this.closeBtn.addEventListener('click', this.boundOnClose);
  }

  private removeEvents(): void {
    if (this.boundOnInput) {
      this.input.removeEventListener('input', this.boundOnInput);
    }
    if (this.boundOnKeydown) {
      this.input.removeEventListener('keydown', this.boundOnKeydown);
    }
    if (this.boundOnPrev) {
      this.prevBtn.removeEventListener('click', this.boundOnPrev);
    }
    if (this.boundOnNext) {
      this.nextBtn.removeEventListener('click', this.boundOnNext);
    }
    if (this.boundOnClose) {
      this.closeBtn.removeEventListener('click', this.boundOnClose);
    }
  }
}
