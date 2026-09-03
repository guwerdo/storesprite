import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Container } from 'inversify';
import { mock } from 'vitest-mock-extended';
import { ContainerProvider } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import type { IMappingService } from '../../../types/stocksprite/MappingService.interface.js';
import type { IConnectionService } from '../../../types/stocksprite/ConnectionService.interface.js';
import StockSpriteScheduleTab from './StockSpriteScheduleTab.js';
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

describe('StockSpriteScheduleTab', () => {
  let mockMappingService: ReturnType<typeof mock<IMappingService>>;
  let mockConnectionService: ReturnType<typeof mock<IConnectionService>>;
  let testContainer: Container;

  beforeEach(() => {
    mockMappingService = mock<IMappingService>();
    mockMappingService.getMappings.mockResolvedValue({ mappings: [] });
    mockMappingService.updateMapping.mockResolvedValue({ success: true });
    mockMappingService.getRules.mockResolvedValue({ rules: [] });
    mockMappingService.runMapping.mockResolvedValue({ success: true });
    mockMappingService.getHistory.mockResolvedValue({ history: [] });

    mockConnectionService = mock<IConnectionService>();
    mockConnectionService.getConnections.mockResolvedValue({ connections: [] });

    testContainer = new Container();
    testContainer.bind<IMappingService>(TYPES.IMappingService).toConstantValue(mockMappingService);
    testContainer.bind<IConnectionService>(TYPES.IConnectionService).toConstantValue(mockConnectionService);
  });

  const renderTab = () =>
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <StockSpriteScheduleTab />
        </ContainerProvider>
      </I18nProvider>,
    );

  it('renders the empty state when there are no schedules', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No schedules yet|Még nincsenek ütemezések/i)).toBeInTheDocument();
    });
  });

  it('switches to the add form when "Add schedule" is clicked', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No schedules yet|Még nincsenek ütemezések/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Add schedule|Ütemezés hozzáadása/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save schedule|Ütemezés mentése/i })).toBeInTheDocument();
    });
  });

  it('renders scheduled mappings in the table', async () => {
    mockMappingService.getMappings.mockResolvedValueOnce({
      mappings: [
        {
          id: 'mapping-1',
          name: 'Cromwell',
          scheduleEnabled: true,
          schedule: { frequency: 'daily', times: [9] },
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
