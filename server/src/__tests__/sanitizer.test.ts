import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeDescription } from '../middleware/sanitizer.js';

describe('sanitizeText', () => {
  it('strips HTML tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe('Hello');
  });

  it('strips attributes', () => {
    expect(sanitizeText('<a href="javascript:alert(1)">click</a>')).toBe('click');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null as any)).toBe('');
    expect(sanitizeText(undefined as any)).toBe('');
    expect(sanitizeText(123 as any)).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('truncates to max length', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeText(long, 10)).toBe('a'.repeat(10));
  });
});

describe('sanitizeDescription', () => {
  it('allows basic safe tags', () => {
    const result = sanitizeDescription('<p>Hello <b>world</b></p>');
    expect(result).toContain('<p>');
    expect(result).toContain('<b>');
  });

  it('strips script tags', () => {
    const result = sanitizeDescription('<p>Hello</p><script>alert(1)</script>');
    expect(result).not.toContain('<script>');
  });

  it('strips attributes from allowed tags', () => {
    const result = sanitizeDescription('<p onclick="alert(1)">Hello</p>');
    expect(result).toBe('<p>Hello</p>');
  });
});