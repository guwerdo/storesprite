import type React from 'react';
import type { Container } from 'inversify';

export interface IContainerProviderProps {
  container: Container;
  children: React.ReactNode;
}
