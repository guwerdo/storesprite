import React from 'react';
import TabbedPageLayout from '../../components/TabbedPageLayout.js';
import StockSpriteConnectionsTab from './tabs/StockSpriteConnectionsTab.js';
import StockSpriteMappingTab from './tabs/StockSpriteMappingTab.js';
import StockSpriteScheduleTab from './tabs/StockSpriteScheduleTab.js';
import CableOutlinedIcon from '@mui/icons-material/CableOutlined';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useAppTranslation } from '../../i18n/I18nProvider.js';
import type { ITabItemConfig } from '../../types/TabbedPageLayout.interface.js';

export default function StockSpritePage(): React.JSX.Element {
  const { t } = useAppTranslation();

  const tabs: ITabItemConfig[] = [
    {
      id: 'stocksprite-connections',
      label: t('stocksprite.tabs.connections'),
      icon: <CableOutlinedIcon fontSize="small" />,
      content: <StockSpriteConnectionsTab />,
    },
    {
      id: 'stocksprite-mapping',
      label: t('stocksprite.tabs.mapping'),
      icon: <SchemaOutlinedIcon fontSize="small" />,
      content: <StockSpriteMappingTab />,
    },
    {
      id: 'stocksprite-schedule',
      label: t('stocksprite.tabs.schedule'),
      icon: <ScheduleOutlinedIcon fontSize="small" />,
      content: <StockSpriteScheduleTab />,
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

