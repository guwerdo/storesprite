import { describe, it, expect } from 'vitest';
import { en } from '../locales/en.js';
import { hu } from '../locales/hu.js';
import { normalizeLanguageCode } from '../i18n/i18n.js';

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.keys(obj).reduce((acc: string[], k: string) => {
    const pre = prefix.length ? `${prefix}.` : '';
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      acc.push(...getKeys(obj[k] as Record<string, unknown>, pre + k));
    } else {
      acc.push(pre + k);
    }
    return acc;
  }, []);
}

describe('Internationalization (i18n)', () => {
  it('has identical translation key structure across English and Hungarian dictionaries', () => {
    const enKeys = getKeys(en).sort();
    const huKeys = getKeys(hu).sort();

    expect(enKeys).toEqual(huKeys);
  });

  it('normalizes language codes accurately to supported ISO codes', () => {
    expect(normalizeLanguageCode('en')).toBe('en');
    expect(normalizeLanguageCode('en-US')).toBe('en');
    expect(normalizeLanguageCode('en-GB')).toBe('en');
    expect(normalizeLanguageCode('hu')).toBe('hu');
    expect(normalizeLanguageCode('hu-HU')).toBe('hu');
    expect(normalizeLanguageCode(null)).toBe('en');
    expect(normalizeLanguageCode('')).toBe('en');
    expect(normalizeLanguageCode('unknown')).toBe('en');
  });

  it('contains valid language labels in dictionaries', () => {
    expect(en.languages.en).toBe('English');
    expect(en.languages.hu).toBe('Hungarian (Magyar)');
    expect(hu.languages.hu).toBe('Magyar');
  });
});
