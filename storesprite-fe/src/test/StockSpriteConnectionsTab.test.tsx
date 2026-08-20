import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Container } from 'inversify';
import { ContainerProvider } from '../di/ContainerProvider.js';
import { TYPES } from '../di/types.js';
import type { IConnectionService } from '../types/ConnectionService.interface.js';
import StockSpriteConnectionsTab from '../features/stocksprite/tabs/StockSpriteConnectionsTab.js';
import { I18nProvider } from '../i18n/I18nProvider.js';

const mockGetToken = vi.fn().mockResolvedValue('test_token');

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
  }),
}));

describe('StockSpriteConnectionsTab', () => {
  let getConnectionsSpy: ReturnType<typeof vi.fn>;
  let createConnectionSpy: ReturnType<typeof vi.fn>;
  let updateConnectionSpy: ReturnType<typeof vi.fn>;
  let deleteConnectionSpy: ReturnType<typeof vi.fn>;
  let mockConnectionService: IConnectionService;
  let testContainer: Container;

  beforeEach(() => {
    getConnectionsSpy = vi.fn().mockResolvedValue({
      connections: [],
    });
    createConnectionSpy = vi.fn().mockResolvedValue({ success: true });
    updateConnectionSpy = vi.fn().mockResolvedValue({ success: true });
    deleteConnectionSpy = vi.fn().mockResolvedValue({ success: true });

    mockConnectionService = {
      getConnections: getConnectionsSpy,
      getConnection: vi.fn(),
      createConnection: createConnectionSpy,
      updateConnection: updateConnectionSpy,
      deleteConnection: deleteConnectionSpy,
    };

    testContainer = new Container();
    testContainer.bind<IConnectionService>(TYPES.IConnectionService).toConstantValue(mockConnectionService);
  });

  it('renders empty state text when no connections exist', async () => {
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <StockSpriteConnectionsTab />
        </ContainerProvider>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No connections created yet/i)).toBeInTheDocument();
    });
  });

  it('switches to add form when "Add New Connection" is clicked', async () => {
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <StockSpriteConnectionsTab />
        </ContainerProvider>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No connections created yet/i)).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Add New Connection|Új kapcsolat hozzáadása/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Create New Data Connection|Új adatkapcsolat létrehozása/i)).toBeInTheDocument();
    });
  });

  it('renders existing connections in table and opens edit form on row click', async () => {
    getConnectionsSpy.mockResolvedValueOnce({
      connections: [
        {
          id: 'conn-1',
          name: 'Magictools Feed',
          channel: 'HTTP',
          dataFormat: 'CSV',
          config: { channel: 'HTTP', url: 'https://media.magictools.hu/shared/products.csv' },
          dataFormatConfig: { format: 'CSV', delimiter: ';' },
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <StockSpriteConnectionsTab />
        </ContainerProvider>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Magictools Feed')).toBeInTheDocument();
      expect(screen.getByText('HTTP')).toBeInTheDocument();
      expect(screen.getByText('CSV')).toBeInTheDocument();
    });

    // Click row
    fireEvent.click(screen.getByText('Magictools Feed'));

    await waitFor(() => {
      expect(screen.getByText(/Edit Data Connection|Adatkapcsolat szerkesztése/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Magictools Feed')).toBeInTheDocument();
    });
  });
});
