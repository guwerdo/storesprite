import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import i18nInstance, {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  normalizeLanguageCode,
  getInitialLanguage,
} from './i18n.js';
import type { II18nContextValue, II18nProviderProps } from '../types/I18n.interface.js';

export type { II18nContextValue, II18nProviderProps };

const I18nContext = createContext<II18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: II18nProviderProps): React.JSX.Element {
  const { t } = useI18nextTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(getInitialLanguage);

  const handleSetLanguage = useCallback(async (lang: string): Promise<void> => {
    const normalized = normalizeLanguageCode(lang);
    setCurrentLanguage(normalized);
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage?.setItem === 'function') {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      }
    } catch {
      // Ignore localStorage errors
    }
    await i18nInstance.changeLanguage(normalized);
  }, []);

  useEffect(() => {
    const onLanguageChanged = (lng: string): void => {
      const normalized = normalizeLanguageCode(lng);
      setCurrentLanguage(normalized);
    };

    i18nInstance.on('languageChanged', onLanguageChanged);
    return () => {
      i18nInstance.off('languageChanged', onLanguageChanged);
    };
  }, []);

  const value = useMemo<II18nContextValue>(
    () => ({
      language: currentLanguage,
      setLanguage: handleSetLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      t: (key: string, options?: Record<string, unknown>) => t(key, options),
    }),
    [currentLanguage, handleSetLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useAppTranslation(): II18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useAppTranslation must be used within an I18nProvider');
  }
  return context;
}
