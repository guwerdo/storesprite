import React from 'react';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import type { IUserMenuItemConfig } from '../types/UserMenu.interface.js';

export type { IUserMenuItemConfig };

export const USER_MENU_ITEMS: IUserMenuItemConfig[] = [
  {
    id: 'profile',
    label: 'Profile',
    labelKey: 'userMenu.profile',
    path: '/profile',
    icon: <PersonOutlineIcon fontSize="small" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    labelKey: 'userMenu.settings',
    path: '/settings',
    icon: <SettingsOutlinedIcon fontSize="small" />,
  },
];
