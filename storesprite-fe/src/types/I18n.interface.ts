import type React from 'react';
import type { SupportedLanguage } from '../i18n/i18n.js';

export interface II18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: string) => Promise<void>;
  supportedLanguages: readonly SupportedLanguage[];
  t: (key: string, options?: Record<string, unknown>) => string;
}

export interface II18nProviderProps {
  children: React.ReactNode;
}
