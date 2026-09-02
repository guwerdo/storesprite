import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Container } from 'inversify';
import { ContainerProvider } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import { I18nProvider } from '../../../i18n/I18nProvider.js';
import type { IMappingService } from '../../../types/stocksprite/MappingService.interface.js';
import type { ISocketService } from '../../../types/SocketService.interface.js';
import type { IMappingHistoryDto } from '../../../types/stocksprite/Mapping.interface.js';
import RunHistoryPanel from './RunHistoryPanel.js';

const mockGetToken = vi.fn().mockResolvedValue('test_token');

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: 'test_user_id',
  }),
}));

function makeHistoryRow(overrides: Partial<IMappingHistoryDto>): IMappingHistoryDto {
  return {
    id: 'history-1',
    mappingId: 'mapping-1',
    status: 'success',
    trigger: 'manual',
    startedAt: '2026-09-01T08:00:00.000Z',
    finishedAt: '2026-09-01T08:01:00.000Z',
    processedItems: 0,
    updatedItems: 0,
    unchangedItems: 0,
    warningCount: 0,
    errorCount: 0,
    error: null,
    ...overrides,
  };
}

describe('RunHistoryPanel', () => {
  let mockMappingService: IMappingService;
  let getHistoryMock: ReturnType<typeof vi.fn>;
  let socketHandlers: Record<string, ((data: unknown) => void) | undefined>;
  let mockSocketService: ISocketService;

  beforeEach(() => {
    socketHandlers = {};
    mockSocketService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      joinTenant: vi.fn(),
      on: vi.fn((event: string, callback: (data: unknown) => void) => {
        socketHandlers[event] = callback;
      }),
      off: vi.fn((event: string) => {
        socketHandlers[event] = undefined;
      }),
    };

    getHistoryMock = vi.fn();
    mockMappingService = {
      getMappings: vi.fn(),
      createMapping: vi.fn(),
      updateMapping: vi.fn(),
      deleteMapping: vi.fn(),
      getRules: vi.fn(),
      runMapping: vi.fn(),
      getHistory: getHistoryMock,
    };
  });

  const renderPanel = (mappingId = 'mapping-1') =>
    render(
      <I18nProvider>
        <ContainerProvider
          container={(() => {
            const container = new Container();
            container.bind<IMappingService>(TYPES.IMappingService).toConstantValue(mockMappingService);
            container.bind<ISocketService>(TYPES.ISocketService).toConstantValue(mockSocketService);
            return container;
          })()}
        >
          <RunHistoryPanel mappingId={mappingId} />
        </ContainerProvider>
      </I18nProvider>
    );

  it('shows the empty state when the mapping has no runs yet', async () => {
    // Arrange
    getHistoryMock.mockResolvedValue({ history: [] });

    // Act
    renderPanel();

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/No runs yet|Még nincsenek futtatások/i)).toBeInTheDocument();
    });
    expect(getHistoryMock).toHaveBeenCalledWith('test_token', 'mapping-1');
  });

  it('renders the statistics summary and every run row', async () => {
    // Arrange
    const rows: IMappingHistoryDto[] = [
      makeHistoryRow({ status: 'success', trigger: 'manual', processedItems: 10, updatedItems: 8, unchangedItems: 2 }),
      makeHistoryRow({
        id: 'history-2',
        status: 'running',
        trigger: 'schedule',
        finishedAt: null,
        processedItems: 5,
        warningCount: 1,
      }),
      makeHistoryRow({
        id: 'history-3',
        status: 'failed',
        startedAt: '2026-08-30T08:00:00.000Z',
        finishedAt: '2026-08-30T08:02:00.000Z',
        processedItems: 3,
        errorCount: 3,
        error: 'UNAS rejected product',
      }),
    ];
    getHistoryMock.mockResolvedValue({ history: rows });

    // Act
    renderPanel();

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Total runs: 3')).toBeInTheDocument();
    });
    expect(screen.getByText('Running: 1')).toBeInTheDocument();
    expect(screen.getByText('Successful: 1')).toBeInTheDocument();
    expect(screen.getByText('Failed: 1')).toBeInTheDocument();
    expect(screen.getByText('Partial: 0')).toBeInTheDocument();
    expect(screen.getByText('UNAS rejected product')).toBeInTheDocument();
    expect(screen.getAllByText('Manual')).toHaveLength(2);
    expect(screen.getAllByText('Schedule')).toHaveLength(1);
  });

  it('reloads silently when a run event arrives for this mapping', async () => {
    // Arrange
    getHistoryMock.mockResolvedValue({ history: [] });
    renderPanel();

    // Act
    await waitFor(() => {
      expect(screen.getByText(/No runs yet|Még nincsenek futtatások/i)).toBeInTheDocument();
    });
    getHistoryMock.mockResolvedValue({
      history: [makeHistoryRow({ status: 'success' })],
    });

    act(() => {
      socketHandlers['mapping_run_result']?.({ mappingId: 'mapping-1', runId: 'run-1', progress: 'finish', updatedItems: 8 });
    });

    // Assert
    await waitFor(() => {
      expect(getHistoryMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Total runs: 1')).toBeInTheDocument();
    });
  });

  it('ignores run events belonging to another mapping', async () => {
    // Arrange
    getHistoryMock.mockResolvedValue({ history: [] });
    renderPanel();

    // Act
    await waitFor(() => {
      expect(screen.getByText(/No runs yet|Még nincsenek futtatások/i)).toBeInTheDocument();
    });

    act(() => {
      socketHandlers['mapping_run_result']?.({ mappingId: 'mapping-other', runId: 'run-2', progress: 'finish' });
    });

    // Assert
    expect(getHistoryMock).toHaveBeenCalledTimes(1);
  });
});
