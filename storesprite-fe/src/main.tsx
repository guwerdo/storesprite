import 'reflect-metadata';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ContainerProvider } from './di/ContainerProvider.js';
import { container } from './di/container.js';
import App from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ContainerProvider container={container}>
      <App />
    </ContainerProvider>
  </React.StrictMode>,
);
