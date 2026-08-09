import React, { createContext, useContext } from 'react';
import type { Container, interfaces } from 'inversify';

const ContainerContext = createContext<Container | null>(null);

interface ContainerProviderProps {
  container: Container;
  children: React.ReactNode;
}

export function ContainerProvider({ container, children }: ContainerProviderProps): React.JSX.Element {
  return (
    <ContainerContext.Provider value={container}>
      {children}
    </ContainerContext.Provider>
  );
}

export function useInjection<T>(identifier: interfaces.ServiceIdentifier<T>): T {
  const ctx = useContext(ContainerContext);
  if (ctx === null) {
    throw new Error('useInjection must be used within a ContainerProvider');
  }
  return ctx.get<T>(identifier);
}
