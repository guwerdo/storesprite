import 'reflect-metadata';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Container } from 'inversify';
import { ContainerProvider, useInjection } from './ContainerProvider.js';
import { TYPES } from './types.js';
import type { IHttpClient } from '../types/HttpClient.interface.js';

// A simple component that uses the IHttpClient service via DI
function ApiStatusComponent(): React.JSX.Element {
  const httpClient = useInjection<IHttpClient>(TYPES.IHttpClient);
  const label = httpClient ? 'HttpClient injected' : 'No client';
  return <div data-testid="status">{label}</div>;
}

describe('ContainerProvider + useInjection', () => {
  it('injects a mocked IHttpClient into a component', () => {
    const mockHttpClient: IHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const testContainer = new Container();
    testContainer.bind<IHttpClient>(TYPES.IHttpClient).toConstantValue(mockHttpClient);

    render(
      <ContainerProvider container={testContainer}>
        <ApiStatusComponent />
      </ContainerProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('HttpClient injected');
  });
});
