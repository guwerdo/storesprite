import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout.js';
import AuthGuard from './components/AuthGuard.js';
import HomePage from './pages/HomePage.js';
import SamplePage from './pages/SamplePage.js';
import ProfilePage from './pages/ProfilePage.js';
import { AppThemeProvider, useColorMode } from './theme/AppThemeProvider.js';
import { ClerkProvider } from '@clerk/clerk-react';

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
      { index: true, element: <HomePage /> },
      { path: 'sample', element: <SamplePage /> },
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
    <AppThemeProvider>
      <ClerkWithTheme />
    </AppThemeProvider>
  );
}
