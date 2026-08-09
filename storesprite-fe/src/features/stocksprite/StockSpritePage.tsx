import React from 'react';
import TabbedPageLayout from '../../components/TabbedPageLayout.js';
import StockSpriteMainTab from './tabs/StockSpriteMainTab.js';
import StockSpriteSettingsTab from './tabs/StockSpriteSettingsTab.js';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAppTranslation } from '../../i18n/I18nProvider.js';
import type { ITabItemConfig } from '../../types/TabbedPageLayout.interface.js';

export default function StockSpritePage(): React.JSX.Element {
  const { t } = useAppTranslation();

  const tabs: ITabItemConfig[] = [
    {
      id: 'stocksprite-main',
      label: t('stocksprite.tabs.sync'),
      icon: <Inventory2OutlinedIcon fontSize="small" />,
      content: <StockSpriteMainTab />,
    },
    {
      id: 'stocksprite-settings',
      label: t('stocksprite.tabs.settings'),
      icon: <SettingsOutlinedIcon fontSize="small" />,
      content: <StockSpriteSettingsTab />,
    },
  ];

  return (
    <TabbedPageLayout
      title={t('stocksprite.title')}
      description={t('stocksprite.description')}
      tabs={tabs}
    />
  );
}
