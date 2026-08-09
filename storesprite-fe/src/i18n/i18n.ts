import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '../locales/en.js';
import { hu } from '../locales/hu.js';

export const SUPPORTED_LANGUAGES = ['en', 'hu'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'storesprite_language';

export function normalizeLanguageCode(code?: string | null): SupportedLanguage {
  if (!code) return DEFAULT_LANGUAGE;
  const lower = code.toLowerCase().trim();
  if (lower === 'hu' || lower.startsWith('hu-')) {
    return 'hu';
  }
  return 'en';
}

export function getInitialLanguage(): SupportedLanguage {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function') {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored) {
        return normalizeLanguageCode(stored);
      }
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      return normalizeLanguageCode(navigator.language);
    }
  } catch {
    // Fallback on error
  }
  return DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hu: { translation: hu },
  },
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

export default i18n;
