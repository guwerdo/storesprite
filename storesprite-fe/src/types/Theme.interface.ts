import type React from 'react';
import type { dark } from '@clerk/themes';

export type ColorMode = 'light' | 'dark';

export interface IColorModeContextType {
  mode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
  clerkAppearance: { baseTheme?: typeof dark };
}

export interface IAppThemeProviderProps {
  children: React.ReactNode;
}
