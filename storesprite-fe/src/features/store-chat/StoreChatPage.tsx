import React from 'react';
import TabbedPageLayout from '../../components/TabbedPageLayout.js';
import StoreChatMainTab from './tabs/StoreChatMainTab.js';
import StoreChatSettingsTab from './tabs/StoreChatSettingsTab.js';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAppTranslation } from '../../i18n/I18nProvider.js';
import type { ITabItemConfig } from '../../types/TabbedPageLayout.interface.js';

export default function StoreChatPage(): React.JSX.Element {
  const { t } = useAppTranslation();

  const tabs: ITabItemConfig[] = [
    {
      id: 'store-chat-main',
      label: t('storeChat.tabs.chat'),
      icon: <SmartToyOutlinedIcon fontSize="small" />,
      content: <StoreChatMainTab />,
    },
    {
      id: 'store-chat-settings',
      label: t('storeChat.tabs.settings'),
      icon: <SettingsOutlinedIcon fontSize="small" />,
      content: <StoreChatSettingsTab />,
    },
  ];

  return (
    <TabbedPageLayout
      title={t('storeChat.title')}
      description={t('storeChat.description')}
      tabs={tabs}
    />
  );
}
