import type React from 'react';

export interface INavItemConfig {
  id: string;
  label: string;
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
  dividerAfter?: boolean;
}
