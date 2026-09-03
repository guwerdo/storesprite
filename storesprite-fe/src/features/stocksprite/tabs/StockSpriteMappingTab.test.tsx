import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Container } from 'inversify';
import { mock } from 'vitest-mock-extended';
import { ContainerProvider } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import type { IMappingService } from '../../../types/stocksprite/MappingService.interface.js';
import type { IConnectionService } from '../../../types/stocksprite/ConnectionService.interface.js';
import type { IUnasService } from '../../../types/unas/UnasService.interface.js';
import StockSpriteMappingTab from './StockSpriteMappingTab.js';
import { I18nProvider } from '../../../i18n/I18nProvider.js';

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
  let mockMappingService: ReturnType<typeof mock<IMappingService>>;
  let mockConnectionService: ReturnType<typeof mock<IConnectionService>>;
  let mockUnasService: ReturnType<typeof mock<IUnasService>>;
  let testContainer: Container;

  beforeEach(() => {
    mockMappingService = mock<IMappingService>();
    mockMappingService.getMappings.mockResolvedValue({ mappings: [] });
    mockMappingService.createMapping.mockResolvedValue({ success: true });
    mockMappingService.updateMapping.mockResolvedValue({ success: true });
    mockMappingService.deleteMapping.mockResolvedValue({ success: true });
    mockMappingService.getRules.mockResolvedValue({ rules: [] });
    mockMappingService.runMapping.mockResolvedValue({ success: true });
    mockMappingService.getHistory.mockResolvedValue({ history: [] });

    mockConnectionService = mock<IConnectionService>();
    mockConnectionService.getConnections.mockResolvedValue({ connections: [] });

    mockUnasService = mock<IUnasService>();
    mockUnasService.getWarehouses.mockResolvedValue({ warehouses: [] });

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
    mockMappingService.getMappings.mockResolvedValueOnce({
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
