import type {PropertyValue} from '../types.js';
import {el} from './domUtils.js';

export type PropertyType = 'string' | 'number' | 'boolean' | 'date' | 'url' | 'email';

const URL_KEY_PATTERN = /url|link|href|website|site/i;
const EMAIL_KEY_PATTERN = /email|mail/i;
const DATE_KEY_PATTERN = /date|time|\bat\b|created|updated|born|birthday/i;

const URL_VALUE_PATTERN = /^https?:\/\/.+/i;
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

/**
 * Detect the property type from key name and current value.
 */
export function detectPropertyType(key: string, value: PropertyValue): PropertyType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';

  const strVal = value === null ? '' : String(value);

  if (EMAIL_KEY_PATTERN.test(key) || EMAIL_VALUE_PATTERN.test(strVal)) return 'email';
  if (URL_KEY_PATTERN.test(key) || URL_VALUE_PATTERN.test(strVal)) return 'url';
  if (DATE_KEY_PATTERN.test(key) || DATE_VALUE_PATTERN.test(strVal)) return 'date';

  return 'string';
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validate a string value against the given property type.
 */
export function validatePropertyValue(type: PropertyType, value: string): ValidationResult {
  if (value === '') return { valid: true };

  switch (type) {
    case 'email': {
      const ok = EMAIL_VALUE_PATTERN.test(value);
      return ok ? { valid: true } : { valid: false, message: '有効なメールアドレスを入力してください' };
    }
    case 'url': {
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, message: '有効なURLを入力してください (例: https://example.com)' };
      }
    }
    case 'date': {
      const ok = DATE_VALUE_PATTERN.test(value) && !isNaN(Date.parse(value));
      return ok ? { valid: true } : { valid: false, message: '有効な日付を入力してください (YYYY-MM-DD)' };
    }
    case 'number': {
      const ok = value !== '' && !isNaN(Number(value));
      return ok ? { valid: true } : { valid: false, message: '有効な数値を入力してください' };
    }
    default:
      return { valid: true };
  }
}

/**
 * Convert a raw PropertyValue to the string representation used in inputs.
 */
export function propertyValueToString(value: PropertyValue): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return String(value);
  return String(value);
}

/**
 * Parse a string input back to a PropertyValue, coercing types where appropriate.
 */
export function parsePropertyValue(type: PropertyType, raw: string): PropertyValue {
  if (raw === '') return null;
  switch (type) {
    case 'number': {
      const n = Number(raw);
      return isNaN(n) ? raw : n;
    }
    case 'boolean':
      return raw === 'true';
    default:
      return raw;
  }
}

function getSafeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export interface PropertyInputOptions {
  key: string;
  value: PropertyValue;
  onChange: (value: PropertyValue) => void;
}

/**
 * Create a type-aware input element for a property value.
 * Returns the wrapper element containing the input (and optional link/error).
 */
export function createPropertyInput(opts: PropertyInputOptions): HTMLElement {
  const { key, value, onChange } = opts;
  const type = detectPropertyType(key, value);
  const strVal = propertyValueToString(value);

  const wrapper = el('div', { class: 'prop-input-wrapper' });

  if (type === 'boolean') {
    const checkbox = el('input', {
      type: 'checkbox',
      class: 'prop-value-checkbox',
      'data-key': key,
    }) as HTMLInputElement;
    checkbox.checked = value === true || value === 'true';
    checkbox.addEventListener('change', () => {
      onChange(checkbox.checked);
    });
    wrapper.appendChild(checkbox);
    return wrapper;
  }

  const inputAttrs: Record<string, string> = {
    class: 'prop-value-input',
    'data-key': key,
    value: strVal,
  };

  let inputType = 'text';
  let placeholder = '';

  switch (type) {
    case 'date':
      inputType = 'date';
      break;
    case 'url':
      inputType = 'url';
      placeholder = 'https://example.com';
      break;
    case 'email':
      inputType = 'email';
      placeholder = 'user@example.com';
      break;
    case 'number':
      inputType = 'number';
      break;
  }

  inputAttrs['type'] = inputType;
  if (placeholder) inputAttrs['placeholder'] = placeholder;

  const input = el('input', inputAttrs) as HTMLInputElement;

  // For date inputs, normalize value to YYYY-MM-DD
  if (type === 'date' && strVal) {
    input.value = strVal.substring(0, 10);
  }

  const errorEl = el('div', { class: 'prop-validation-error nb-hidden' });

  function handleChange(): void {
    const raw = input.value.trim();
    const result = validatePropertyValue(type, raw);
    if (!result.valid) {
      errorEl.textContent = result.message ?? '';
      errorEl.classList.remove('nb-hidden');
      input.classList.add('prop-value-input--invalid');
      return;
    }
    errorEl.classList.add('nb-hidden');
    input.classList.remove('prop-value-input--invalid');
    onChange(parsePropertyValue(type, raw));
  }

  input.addEventListener('change', handleChange);

  wrapper.appendChild(input);
  wrapper.appendChild(errorEl);

  // For URL values, add an open-link button
  const safeUrl = type === 'url' && strVal ? getSafeHttpUrl(strVal) : null;
  if (safeUrl) {
    const linkBtn = el('a', {
      class: 'prop-url-link',
      href: safeUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: 'リンクを開く',
    }, '↗');
    wrapper.appendChild(linkBtn);
  }

  return wrapper;
}

/**
 * Returns a badge label for the detected property type (non-string types only).
 */
export function getPropertyTypeBadge(type: PropertyType): string | null {
  switch (type) {
    case 'date': return '📅';
    case 'url': return '🔗';
    case 'email': return '✉';
    case 'number': return '#';
    case 'boolean': return '☑';
    default: return null;
  }
}
