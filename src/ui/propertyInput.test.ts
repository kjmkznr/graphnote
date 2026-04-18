import { describe, expect, it } from 'vitest';
import {
  detectPropertyType,
  getPropertyTypeBadge,
  parsePropertyValue,
  propertyValueToString,
  validatePropertyValue,
} from './propertyInput.js';

describe('detectPropertyType', () => {
  it('returns boolean for boolean values', () => {
    expect(detectPropertyType('active', true)).toBe('boolean');
    expect(detectPropertyType('active', false)).toBe('boolean');
  });

  it('returns number for numeric values', () => {
    expect(detectPropertyType('age', 42)).toBe('number');
    expect(detectPropertyType('score', 3.14)).toBe('number');
  });

  it('detects email by key name', () => {
    expect(detectPropertyType('email', 'foo')).toBe('email');
    expect(detectPropertyType('userEmail', 'foo')).toBe('email');
    expect(detectPropertyType('mail', 'foo')).toBe('email');
  });

  it('detects email by value pattern', () => {
    expect(detectPropertyType('contact', 'user@example.com')).toBe('email');
  });

  it('detects url by key name', () => {
    expect(detectPropertyType('url', 'foo')).toBe('url');
    expect(detectPropertyType('website', 'foo')).toBe('url');
    expect(detectPropertyType('link', 'foo')).toBe('url');
  });

  it('detects url by value pattern', () => {
    expect(detectPropertyType('homepage', 'https://example.com')).toBe('url');
    expect(detectPropertyType('ref', 'http://example.com/path')).toBe('url');
  });

  it('detects date by key name', () => {
    expect(detectPropertyType('createdAt', null)).toBe('date');
    expect(detectPropertyType('birthday', null)).toBe('date');
    expect(detectPropertyType('updatedAt', null)).toBe('date');
  });

  it('does not mis-detect non-date words containing "at"', () => {
    expect(detectPropertyType('status', 'active')).toBe('string');
  });

  it('detects date by value pattern', () => {
    expect(detectPropertyType('foo', '2024-01-15')).toBe('date');
    expect(detectPropertyType('foo', '2024-01-15T10:30')).toBe('date');
  });

  it('returns string for plain text', () => {
    expect(detectPropertyType('name', 'Alice')).toBe('string');
    expect(detectPropertyType('description', null)).toBe('string');
  });

  it('email takes priority over url when key matches email', () => {
    expect(detectPropertyType('email', 'https://example.com')).toBe('email');
  });
});

describe('validatePropertyValue', () => {
  it('accepts empty string for any type', () => {
    expect(validatePropertyValue('email', '')).toEqual({ valid: true });
    expect(validatePropertyValue('url', '')).toEqual({ valid: true });
    expect(validatePropertyValue('date', '')).toEqual({ valid: true });
    expect(validatePropertyValue('number', '')).toEqual({ valid: true });
  });

  it('validates email', () => {
    expect(validatePropertyValue('email', 'user@example.com').valid).toBe(true);
    expect(validatePropertyValue('email', 'invalid-email').valid).toBe(false);
    expect(validatePropertyValue('email', 'no-at-sign').valid).toBe(false);
  });

  it('validates url', () => {
    expect(validatePropertyValue('url', 'https://example.com').valid).toBe(true);
    expect(validatePropertyValue('url', 'http://foo.bar/path?q=1').valid).toBe(true);
    expect(validatePropertyValue('url', 'not-a-url').valid).toBe(false);
    expect(validatePropertyValue('url', 'ftp://example.com').valid).toBe(true);
    expect(validatePropertyValue('url', 'javascript:alert(1)').valid).toBe(true);
  });

  it('validates date', () => {
    expect(validatePropertyValue('date', '2024-01-15').valid).toBe(true);
    expect(validatePropertyValue('date', '2024-13-01').valid).toBe(false);
    expect(validatePropertyValue('date', 'not-a-date').valid).toBe(false);
    expect(validatePropertyValue('date', '01/15/2024').valid).toBe(false);
  });

  it('validates number', () => {
    expect(validatePropertyValue('number', '42').valid).toBe(true);
    expect(validatePropertyValue('number', '3.14').valid).toBe(true);
    expect(validatePropertyValue('number', '-10').valid).toBe(true);
    expect(validatePropertyValue('number', 'abc').valid).toBe(false);
  });

  it('always valid for string type', () => {
    expect(validatePropertyValue('string', 'anything').valid).toBe(true);
  });

  it('returns error message on failure', () => {
    const result = validatePropertyValue('email', 'bad');
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });
});

describe('parsePropertyValue', () => {
  it('returns null for empty string', () => {
    expect(parsePropertyValue('string', '')).toBeNull();
    expect(parsePropertyValue('number', '')).toBeNull();
  });

  it('parses number', () => {
    expect(parsePropertyValue('number', '42')).toBe(42);
    expect(parsePropertyValue('number', '3.14')).toBe(3.14);
  });

  it('returns raw string for invalid number', () => {
    expect(parsePropertyValue('number', 'abc')).toBe('abc');
  });

  it('parses boolean', () => {
    expect(parsePropertyValue('boolean', 'true')).toBe(true);
    expect(parsePropertyValue('boolean', 'false')).toBe(false);
  });

  it('returns string for string/url/email/date types', () => {
    expect(parsePropertyValue('string', 'hello')).toBe('hello');
    expect(parsePropertyValue('url', 'https://example.com')).toBe('https://example.com');
    expect(parsePropertyValue('email', 'a@b.com')).toBe('a@b.com');
    expect(parsePropertyValue('date', '2024-01-15')).toBe('2024-01-15');
  });
});

describe('propertyValueToString', () => {
  it('converts null to empty string', () => {
    expect(propertyValueToString(null)).toBe('');
  });

  it('converts boolean to string', () => {
    expect(propertyValueToString(true)).toBe('true');
    expect(propertyValueToString(false)).toBe('false');
  });

  it('converts number to string', () => {
    expect(propertyValueToString(42)).toBe('42');
  });

  it('returns string as-is', () => {
    expect(propertyValueToString('hello')).toBe('hello');
  });
});

describe('getPropertyTypeBadge', () => {
  it('returns null for string type', () => {
    expect(getPropertyTypeBadge('string')).toBeNull();
  });

  it('returns badge for typed properties', () => {
    expect(getPropertyTypeBadge('date')).toBeTruthy();
    expect(getPropertyTypeBadge('url')).toBeTruthy();
    expect(getPropertyTypeBadge('email')).toBeTruthy();
    expect(getPropertyTypeBadge('number')).toBeTruthy();
    expect(getPropertyTypeBadge('boolean')).toBeTruthy();
  });
});
