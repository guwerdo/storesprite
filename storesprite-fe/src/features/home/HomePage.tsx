import React from 'react';
import TabbedPageLayout from '../../components/TabbedPageLayout.js';
import StockSpriteMainTab from '../stocksprite/tabs/StockSpriteMainTab.js';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import { useAppTranslation } from '../../i18n/I18nProvider.js';
import type { ITabItemConfig } from '../../types/TabbedPageLayout.interface.js';

export default function HomePage(): React.JSX.Element {
  const { t } = useAppTranslation();

  const tabs: ITabItemConfig[] = [
    {
      id: 'home-overview',
      label: t('stocksprite.tabs.sync'),
      icon: <DashboardOutlinedIcon fontSize="small" />,
      content: <StockSpriteMainTab />,
    },
  ];

  return (
    <TabbedPageLayout
      title={t('home.title')}
      description={t('home.description')}
      tabs={tabs}
    />
  );
}
