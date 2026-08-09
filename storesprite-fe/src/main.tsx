import 'reflect-metadata';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { ContainerProvider } from './di/ContainerProvider.js';
import { container } from './di/container.js';
import App from './App.js';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Vite environment variable: VITE_CLERK_PUBLISHABLE_KEY');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ContainerProvider container={container}>
        <App />
      </ContainerProvider>
    </ClerkProvider>
  </React.StrictMode>,
);
