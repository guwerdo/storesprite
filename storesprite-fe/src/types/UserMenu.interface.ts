import type React from 'react';

export interface IUserMenuItemConfig {
  id: string;
  label: string;
  labelKey: string;
  path?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  dividerAfter?: boolean;
  color?: 'inherit' | 'primary' | 'error';
}

export interface IUserMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}
