import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout.js';
import AuthGuard from './components/AuthGuard.js';
import StockSpritePage from './features/stocksprite/StockSpritePage.js';
import StoreChatPage from './features/store-chat/StoreChatPage.js';
import SearchSpritePage from './features/search-sprite/SearchSpritePage.js';
import SettingsPage from './features/settings/SettingsPage.js';
import ProfilePage from './features/profile/ProfilePage.js';
import { AppThemeProvider, useColorMode } from './theme/AppThemeProvider.js';
import { ClerkProvider } from '@clerk/clerk-react';
import { I18nProvider } from './i18n/I18nProvider.js';

const PUBLISHABLE_KEY = 'pk_test_aW50ZXJuYWwtZWZ0LTg3LmNsZXJrLmFjY291bnRzLmRldiQ';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <StockSpritePage /> },
      { path: 'chat', element: <StoreChatPage /> },
      { path: 'search', element: <SearchSpritePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
]);

function ClerkWithTheme(): React.JSX.Element {
  const { clerkAppearance } = useColorMode();

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
      <RouterProvider router={router} />
    </ClerkProvider>
  );
}

export default function App(): React.JSX.Element {
  return (
    <I18nProvider>
      <AppThemeProvider>
        <ClerkWithTheme />
      </AppThemeProvider>
    </I18nProvider>
  );
}
