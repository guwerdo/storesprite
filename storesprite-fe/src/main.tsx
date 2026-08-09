import 'reflect-metadata';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { ContainerProvider } from './di/ContainerProvider.js';
import { container } from './di/container.js';
import App from './App.js';

const PUBLISHABLE_KEY = 'pk_test_aW50ZXJuYWwtZWZ0LTg3LmNsZXJrLmFjY291bnRzLmRldiQ';

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
