import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout.js';
import AuthGuard from './components/AuthGuard.js';
import HomePage from './pages/HomePage.js';
import SamplePage from './pages/SamplePage.js';
import ProfilePage from './pages/ProfilePage.js';

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

export default function App(): React.JSX.Element {
  return <RouterProvider router={router} />;
}
