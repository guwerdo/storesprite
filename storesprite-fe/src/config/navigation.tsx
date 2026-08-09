import React from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SavedSearchOutlinedIcon from '@mui/icons-material/SavedSearchOutlined';
import type { INavItemConfig } from '../types/Navigation.interface.js';

export type { INavItemConfig };

export const DRAWER_NAV_ITEMS: INavItemConfig[] = [
  {
    id: 'stocksprite',
    label: 'Stock Sprite',
    labelKey: 'nav.stockSprite',
    path: '/',
    icon: <Inventory2OutlinedIcon />,
  },
  {
    id: 'store-chat',
    label: 'Store Chat AI',
    labelKey: 'nav.storeChat',
    path: '/chat',
    icon: <SmartToyOutlinedIcon />,
  },
  {
    id: 'search-sprite',
    label: 'Search Sprite AI',
    labelKey: 'nav.searchSprite',
    path: '/search',
    icon: <SavedSearchOutlinedIcon />,
  },
];
