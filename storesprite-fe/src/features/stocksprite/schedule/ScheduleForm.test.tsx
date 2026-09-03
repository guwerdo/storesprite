import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Container } from 'inversify';
import { mock } from 'vitest-mock-extended';
import ScheduleForm from './ScheduleForm.js';
import type { ScheduleFormProps } from './ScheduleForm.js';
import { I18nProvider } from '../../../i18n/I18nProvider.js';
import { ContainerProvider } from '../../../di/ContainerProvider.js';
import { TYPES } from '../../../di/types.js';
import type { IMappingService } from '../../../types/stocksprite/MappingService.interface.js';
import type { ISocketService } from '../../../types/SocketService.interface.js';
import type { IMapping } from '../../../types/stocksprite/Mapping.interface.js';
import type { IDataConnection } from '../../../types/stocksprite/DataConnection.interface.js';

const mockGetToken = vi.fn().mockResolvedValue('test_token');

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: 'test_user_id',
  }),
}));

const makeMapping = (overrides: Partial<IMapping> = {}): IMapping => ({
  id: 'mapping-1',
  name: 'Cromwell',
  scheduleEnabled: true,
  schedule: { frequency: 'daily', times: [9] },
  connectionId: 'conn-1',
  skuField: 'part',
  skuRules: null,
  stockMappings: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeConnection = (): IDataConnection =>
  ({ id: 'conn-1', name: 'Cromwell Feed', testResult: { success: true, columns: ['part'] } }) as unknown as IDataConnection;

describe('ScheduleForm', () => {
  const renderForm = (overrides: Partial<ScheduleFormProps> = {}) => {
    const props: ScheduleFormProps = {
      initialMapping: makeMapping(),
      connections: [makeConnection()],
      mappings: [makeMapping()],
      onSave: vi.fn().mockResolvedValue(undefined),
      onDelete: vi.fn().mockResolvedValue(undefined),
      onRun: vi.fn().mockResolvedValue(undefined),
      onCancel: vi.fn(),
      ...overrides,
    };
    const container = new Container();
    const mappingService = mock<IMappingService>();
    mappingService.getHistory.mockResolvedValue({ history: [] });
    container.bind<IMappingService>(TYPES.IMappingService).toConstantValue(mappingService);
    container.bind<ISocketService>(TYPES.ISocketService).toConstantValue(mock<ISocketService>());
    return render(
      <I18nProvider>
        <ContainerProvider container={container}>
          <ScheduleForm {...props} />
        </ContainerProvider>
      </I18nProvider>,
    );
  };

  it('renders the connection name and enables "Run now" in edit mode', () => {
    renderForm();

    expect(screen.getByText('Cromwell Feed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run now/i })).toBeEnabled();
  });

  it('saves the schedule with the correct payload', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderForm({ onSave });

    fireEvent.click(screen.getByRole('button', { name: /Save schedule/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith('mapping-1', {
        scheduleEnabled: true,
        schedule: { frequency: 'daily', times: [9] },
      }),
    );
  });

  it('confirms before deleting a schedule', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderForm({ onDelete });

    fireEvent.click(screen.getByRole('button', { name: /Delete schedule/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Yes, Delete/i }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('mapping-1'));
  });

  it('disables "Run now" and "Save" in add mode before a connection is picked', () => {
    renderForm({ initialMapping: null });

    expect(screen.getByRole('button', { name: /Run now/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save schedule/i })).toBeDisabled();
  });

  it('switches frequency to monthly and shows the day-of-month field', () => {
    renderForm();

    fireEvent.click(screen.getByRole('radio', { name: /Monthly/i }));

    expect(screen.getAllByText(/Day of month/i).length).toBeGreaterThan(0);
  });

  it('disables "Run now" after an edit (dirty)', () => {
    renderForm();

    expect(screen.getByRole('button', { name: /Run now/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('radio', { name: /Monthly/i }));

    expect(screen.getByRole('button', { name: /Run now/i })).toBeDisabled();
  });
});
