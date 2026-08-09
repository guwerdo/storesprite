import TabbedPageLayout from '../../components/TabbedPageLayout.js';
import type { ITabItemConfig } from '../../types/TabbedPageLayout.interface.js';
import SearchSpriteMainTab from './tabs/SearchSpriteMainTab.js';
import SearchSpriteSettingsTab from './tabs/SearchSpriteSettingsTab.js';
import SavedSearchOutlinedIcon from '@mui/icons-material/SavedSearchOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useAppTranslation } from '../../i18n/I18nProvider.js';

export default function SearchSpritePage(): React.JSX.Element {
  const { t } = useAppTranslation();

  const tabs: ITabItemConfig[] = [
    {
      id: 'search-sprite-main',
      label: t('searchSprite.tabs.search'),
      icon: <SavedSearchOutlinedIcon fontSize="small" />,
      content: <SearchSpriteMainTab />,
    },
    {
      id: 'search-sprite-settings',
      label: t('searchSprite.tabs.settings'),
      icon: <SettingsOutlinedIcon fontSize="small" />,
      content: <SearchSpriteSettingsTab />,
    },
  ];

  return (
    <TabbedPageLayout
      title={t('searchSprite.title')}
      description={t('searchSprite.description')}
      tabs={tabs}
    />
  );
}
