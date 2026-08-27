import React, { createContext, useContext } from 'react';
import type { Container, ServiceIdentifier } from 'inversify';
import type { IContainerProviderProps } from '../types/Container.interface.js';

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({ container, children }: IContainerProviderProps): React.JSX.Element {
  return (
    <ContainerContext.Provider value={container}>
      {children}
    </ContainerContext.Provider>
  );
}

export function useInjection<T>(identifier: ServiceIdentifier<T>): T {
  const ctx = useContext(ContainerContext);
  if (ctx === null) {
    throw new Error('useInjection must be used within a ContainerProvider');
  }
  return ctx.get<T>(identifier);
}
