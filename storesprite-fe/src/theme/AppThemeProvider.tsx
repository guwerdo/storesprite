import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, alpha } from '@mui/material';
import { enUS, huHU } from '@mui/material/locale';
import { dark } from '@clerk/themes';
import { useAppTranslation } from '../i18n/I18nProvider.js';
import type { IColorModeContextType, IAppThemeProviderProps, ColorMode } from '../types/Theme.interface.js';

export type { ColorMode, IColorModeContextType, IAppThemeProviderProps };

const ColorModeContext = createContext<IColorModeContextType>({
  mode: 'dark',
  toggleColorMode: () => {
    // default noop
  },
  setColorMode: () => {
    // default noop
  },
  clerkAppearance: { baseTheme: dark },
});

export const useColorMode = (): IColorModeContextType => useContext(ColorModeContext);

const STORAGE_KEY = 'storesprite_color_mode';

export function AppThemeProvider({ children }: IAppThemeProviderProps): React.JSX.Element {
  const [mode, setModeState] = useState<ColorMode>(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function') {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
      }
    } catch {
      // Ignore storage access errors in restricted environments
    }
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)')?.matches
      ? 'light'
      : 'dark';
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage?.setItem === 'function') {
        window.localStorage.setItem(STORAGE_KEY, mode);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [mode]);

  const toggleColorMode = (): void => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setColorMode = (newMode: ColorMode): void => {
    setModeState(newMode);
  };

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode,
      setColorMode,
      clerkAppearance: mode === 'dark' ? { baseTheme: dark } : {},
    }),
    [mode],
  );

  let activeLanguage = 'en';
  try {
    const i18n = useAppTranslation();
    activeLanguage = i18n.language;
  } catch {
    // Outside I18nProvider fallback
  }

  const theme = useMemo(() => {
    const isDark = mode === 'dark';
    const muiLocale = activeLanguage === 'hu' ? huHU : enUS;

    const slateBase = {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
      950: '#0B0F19',
    };

    const indigo = {
      50: '#EEF2FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      600: '#4F46E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
      950: '#1E1B4B',
    };

    return createTheme({
      palette: {
        mode,
        primary: {
          main: isDark ? indigo[500] : indigo[600],
          light: isDark ? indigo[400] : indigo[50],
          dark: isDark ? indigo[700] : indigo[800],
          contrastText: '#FFFFFF',
        },
        background: {
          default: isDark ? slateBase[950] : slateBase[50],
          paper: isDark ? '#131B2E' : '#FFFFFF',
        },
        text: {
          primary: isDark ? '#F8FAFC' : slateBase[900],
          secondary: isDark ? slateBase[400] : slateBase[500],
        },
        divider: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)',
      },
      typography: {
        fontFamily: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ].join(','),
        h4: {
          fontWeight: 700,
          letterSpacing: '-0.02em',
        },
        h5: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
        h6: {
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
        subtitle1: {
          fontWeight: 500,
        },
        button: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
      shape: {
        borderRadius: 10,
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              scrollbarColor: isDark ? '#334155 #0B0F19' : '#CBD5E1 #F8FAFC',
              '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                width: 8,
                height: 8,
              },
              '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                borderRadius: 4,
                backgroundColor: isDark ? '#334155' : '#CBD5E1',
              },
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none',
              },
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)'}`,
            },
            elevation1: {
              boxShadow: isDark
                ? '0 1px 3px 0 rgba(0, 0, 0, 0.3)'
                : '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? alpha('#0B0F19', 0.85) : alpha('#FFFFFF', 0.85),
              backdropFilter: 'blur(12px)',
              color: isDark ? '#F8FAFC' : slateBase[900],
              borderBottom: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)'}`,
              boxShadow: 'none',
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderRight: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.9)'}`,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              margin: '4px 8px',
              transition: 'background-color 150ms ease-in-out, color 150ms ease-in-out',
              '&.Mui-selected': {
                backgroundColor: isDark ? alpha(indigo[500], 0.16) : alpha(indigo[600], 0.1),
                color: isDark ? indigo[300] : indigo[700],
                '& .MuiListItemIcon-root': {
                  color: isDark ? indigo[300] : indigo[700],
                },
                '&:hover': {
                  backgroundColor: isDark ? alpha(indigo[500], 0.24) : alpha(indigo[600], 0.16),
                },
              },
              '&:hover': {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              },
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 44,
              fontSize: '0.925rem',
            },
          },
        },
        MuiInputBase: {
          styleOverrides: {
            input: {
              '&:-webkit-autofill': {
                WebkitBoxShadow: `0 0 0 100px ${isDark ? '#131B2E' : '#FFFFFF'} inset !important`,
                WebkitTextFillColor: `${isDark ? '#F8FAFC' : '#0F172A'} !important`,
                caretColor: isDark ? '#F8FAFC' : '#0F172A',
                borderRadius: 'inherit',
                transition: 'background-color 5000s ease-in-out 0s',
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            input: {
              '&:-webkit-autofill': {
                WebkitBoxShadow: `0 0 0 100px ${isDark ? '#131B2E' : '#FFFFFF'} inset !important`,
                WebkitTextFillColor: `${isDark ? '#F8FAFC' : '#0F172A'} !important`,
                caretColor: isDark ? '#F8FAFC' : '#0F172A',
                borderRadius: 'inherit',
                transition: 'background-color 5000s ease-in-out 0s',
              },
            },
          },
        },
      },
    }, muiLocale);
  }, [mode, activeLanguage]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
