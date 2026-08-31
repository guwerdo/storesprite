import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Container } from 'inversify';
import { ContainerProvider } from '../../di/ContainerProvider.js';
import { TYPES } from '../../di/types.js';
import type { IMappingService } from '../../types/stocksprite/MappingService.interface.js';
import type { IConnectionService } from '../../types/stocksprite/ConnectionService.interface.js';
import type { IUnasService } from '../../types/unas/UnasService.interface.js';
import StockSpriteMappingTab from '../../features/stocksprite/tabs/StockSpriteMappingTab.js';
import { I18nProvider } from '../../i18n/I18nProvider.js';

const mockGetToken = vi.fn().mockResolvedValue('test_token');

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: 'test_user_id',
  }),
}));

describe('StockSpriteMappingTab', () => {
  let mockMappingService: IMappingService;
  let mockConnectionService: IConnectionService;
  let mockUnasService: IUnasService;
  let testContainer: Container;

  beforeEach(() => {
    mockMappingService = {
      getMappings: vi.fn().mockResolvedValue({ mappings: [] }),
      createMapping: vi.fn().mockResolvedValue({ success: true }),
      updateMapping: vi.fn().mockResolvedValue({ success: true }),
      deleteMapping: vi.fn().mockResolvedValue({ success: true }),
      getRules: vi.fn().mockResolvedValue({ rules: [] }),
      runMapping: vi.fn().mockResolvedValue({ success: true }),
    };

    mockConnectionService = {
      getConnections: vi.fn().mockResolvedValue({ connections: [] }),
      getConnection: vi.fn(),
      createConnection: vi.fn(),
      updateConnection: vi.fn(),
      deleteConnection: vi.fn(),
      runTest: vi.fn(),
      getTestResult: vi.fn(),
      invalidateConnection: vi.fn(),
    };

    mockUnasService = {
      login: vi.fn(),
      getWarehouses: vi.fn().mockResolvedValue({ warehouses: [] }),
    };

    testContainer = new Container();
    testContainer.bind<IMappingService>(TYPES.IMappingService).toConstantValue(mockMappingService);
    testContainer.bind<IConnectionService>(TYPES.IConnectionService).toConstantValue(mockConnectionService);
    testContainer.bind<IUnasService>(TYPES.IUnasService).toConstantValue(mockUnasService);
  });

  const renderTab = () =>
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <StockSpriteMappingTab />
        </ContainerProvider>
      </I18nProvider>
    );

  it('renders empty state when no mappings exist', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No mappings yet|Még nincsenek leképezések/i)).toBeInTheDocument();
    });
  });

  it('switches to add form when "Add mapping" is clicked', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No mappings yet|Még nincsenek leképezések/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Add mapping|Leképezés hozzáadása/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Create new mapping|Új leképezés létrehozása/i)).toBeInTheDocument();
    });
  });

  it('renders existing mappings in the table', async () => {
    (mockMappingService.getMappings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      mappings: [
        {
          id: 'mapping-1',
          name: 'Cromwell',
          scheduleEnabled: false,
          connectionId: 'conn-1',
          skuField: 'part',
          skuRules: null,
          stockMappings: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Cromwell')).toBeInTheDocument();
    });
  });
});
