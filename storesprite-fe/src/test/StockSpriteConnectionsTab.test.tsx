import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Container } from 'inversify';
import { ContainerProvider } from '../di/ContainerProvider.js';
import { TYPES } from '../di/types.js';
import type { IConnectionService } from '../types/ConnectionService.interface.js';
import type { ISocketService } from '../types/SocketService.interface.js';
import StockSpriteConnectionsTab from '../features/stocksprite/tabs/StockSpriteConnectionsTab.js';
import { I18nProvider } from '../i18n/I18nProvider.js';

const mockGetToken = vi.fn().mockResolvedValue('test_token');

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
    userId: 'test_user_id',
  }),
}));

describe('StockSpriteConnectionsTab', () => {
  let getConnectionsSpy: ReturnType<typeof vi.fn>;
  let createConnectionSpy: ReturnType<typeof vi.fn>;
  let updateConnectionSpy: ReturnType<typeof vi.fn>;
  let deleteConnectionSpy: ReturnType<typeof vi.fn>;
  let mockConnectionService: IConnectionService;
  let mockSocketService: ISocketService;
  let testContainer: Container;

  beforeEach(() => {
    getConnectionsSpy = vi.fn().mockResolvedValue({
      connections: [],
    });
    createConnectionSpy = vi.fn().mockResolvedValue({ connection: { id: 'conn_new', name: 'API Feed' }, success: true });
    updateConnectionSpy = vi.fn().mockResolvedValue({ connection: { id: 'conn_1', name: 'API Feed' }, success: true });
    deleteConnectionSpy = vi.fn().mockResolvedValue({ success: true });

    mockConnectionService = {
      getConnections: getConnectionsSpy,
      getConnection: vi.fn(),
      createConnection: createConnectionSpy,
      updateConnection: updateConnectionSpy,
      deleteConnection: deleteConnectionSpy,
      runTest: vi.fn().mockResolvedValue({ status: 'pending' }),
      getTestResult: vi.fn().mockResolvedValue({ testResult: null }),
      invalidateConnection: vi.fn().mockResolvedValue({ success: true }),
    };

    mockSocketService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      joinTenant: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    testContainer = new Container();
    testContainer.bind<IConnectionService>(TYPES.IConnectionService).toConstantValue(mockConnectionService);
    testContainer.bind<ISocketService>(TYPES.ISocketService).toConstantValue(mockSocketService);
  });

  const renderTab = () =>
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <StockSpriteConnectionsTab />
        </ContainerProvider>
      </I18nProvider>
    );

  const openAddForm = async () => {
    await waitFor(() => {
      expect(screen.getByText(/No connections created yet/i)).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: /Add New Connection|Új kapcsolat hozzáadása/i })[0]
    );
    await waitFor(() => {
      expect(screen.getByText(/Create New Data Connection|Új adatkapcsolat létrehozása/i)).toBeInTheDocument();
    });
  };

  it('renders empty state text when no connections exist', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/No connections created yet/i)).toBeInTheDocument();
    });
  });

  it('switches to add form when "Add New Connection" is clicked', async () => {
    renderTab();

    await openAddForm();
  });

  it('renders existing connections in table and opens edit form with credentials on row click', async () => {
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
          credentials: { authType: 'BASIC', username: 'feed_user', password: 'feed_password' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    renderTab();

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
      expect(screen.getByDisplayValue('feed_user')).toBeInTheDocument();
      expect(screen.getByDisplayValue('feed_password')).toBeInTheDocument();
    });
  });

  it('creates HTTP connection with Bearer token credentials', async () => {
    renderTab();

    await openAddForm();

    // Fill base fields
    fireEvent.change(screen.getByLabelText(/Connection Name|Kapcsolat neve/i), {
      target: { value: 'API Feed' },
    });
    fireEvent.change(screen.getByLabelText(/Remote File URL|Távoli fájl URL/i), {
      target: { value: 'https://example.com/feed.csv' },
    });

    // Switch auth type to Bearer Token
    const authTypeCombobox = screen.getByRole('combobox', { name: /Authentication Type|Hitelesítés típusa/i });
    fireEvent.mouseDown(authTypeCombobox);
    const bearerOption = await screen.findByRole('option', { name: /Bearer Token/i });
    fireEvent.click(bearerOption);

    // Enter Bearer token
    const tokenInput = await screen.findByPlaceholderText(/eyJhbGciOiJIUzI1Ni/i);
    fireEvent.change(tokenInput, { target: { value: 'jwt-token-12345' } });

    // Save
    const saveButton = screen.getByRole('button', { name: /Save Connection|Kapcsolat mentése/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createConnectionSpy).toHaveBeenCalledWith(
        'test_token',
        expect.objectContaining({
          name: 'API Feed',
          channel: 'HTTP',
          dataFormat: 'CSV',
          credentials: {
            authType: 'BEARER',
            token: 'jwt-token-12345',
          },
        })
      );
    });
  });

  it('creates SFTP connection with SSH Private Key credentials and optional passphrase', async () => {
    renderTab();

    await openAddForm();

    // Switch Channel to SFTP
    const channelCombobox = screen.getByRole('combobox', { name: /^Channel$|^Csatorna$/i });
    fireEvent.mouseDown(channelCombobox);
    const sftpOption = await screen.findByRole('option', { name: /SFTP/i });
    fireEvent.click(sftpOption);

    // Fill base fields
    fireEvent.change(screen.getByLabelText(/Connection Name|Kapcsolat neve/i), {
      target: { value: 'SFTP Supplier Feed' },
    });
    fireEvent.change(screen.getByLabelText(/SFTP Server Host|SFTP Kiszolgáló címe/i), {
      target: { value: 'sftp.supplier.com' },
    });
    fireEvent.change(screen.getByLabelText(/Remote Directory|Távoli mappa/i), {
      target: { value: '/stock/csv' },
    });

    // Switch Auth Type to SSH Private Key
    const authTypeCombobox = screen.getByRole('combobox', { name: /Authentication Type|Hitelesítés típusa/i });
    fireEvent.mouseDown(authTypeCombobox);
    const keyOption = await screen.findByRole('option', { name: /SSH Private Key|SSH Privát Kulcs/i });
    fireEvent.click(keyOption);

    // Fill Key credentials
    fireEvent.change(screen.getByLabelText(/Username|Felhasználónév/i), {
      target: { value: 'sftp_user' },
    });
    fireEvent.change(screen.getByPlaceholderText(/BEGIN RSA PRIVATE KEY/), {
      target: { value: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----' },
    });
    fireEvent.change(screen.getByLabelText(/Key Passphrase|Kulcs jelmondata/i), {
      target: { value: 'mypassphrase' },
    });

    // Save
    const saveButton = screen.getByRole('button', { name: /Save Connection|Kapcsolat mentése/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createConnectionSpy).toHaveBeenCalledWith(
        'test_token',
        expect.objectContaining({
          name: 'SFTP Supplier Feed',
          channel: 'SFTP',
          credentials: {
            authType: 'PRIVATE_KEY',
            username: 'sftp_user',
            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----',
            passphrase: 'mypassphrase',
          },
        })
      );
    });
  });

  it('resets credentials state when switching channel from HTTP to SFTP and back', async () => {
    renderTab();

    const addButtons = await screen.findAllByRole('button', { name: /Add New Connection|Új kapcsolat hozzáadása/i });
    fireEvent.click(addButtons[0]);

    // Select Basic Auth in HTTP
    const authTypeCombobox = screen.getByRole('combobox', { name: /Authentication Type|Hitelesítés típusa/i });
    fireEvent.mouseDown(authTypeCombobox);
    const basicOption = await screen.findByRole('option', { name: /Basic Auth|Alapvető hitelesítés/i });
    fireEvent.click(basicOption);

    fireEvent.change(screen.getByLabelText(/Username|Felhasználónév/i), {
      target: { value: 'temp_user' },
    });

    // Switch Channel to SFTP
    const channelCombobox = screen.getByRole('combobox', { name: /^Channel$|^Csatorna$/i });
    fireEvent.mouseDown(channelCombobox);
    const sftpOption = await screen.findByRole('option', { name: /SFTP/i });
    fireEvent.click(sftpOption);

    // Switch back to HTTP
    fireEvent.mouseDown(channelCombobox);
    const httpOption = await screen.findByRole('option', { name: /HTTP/i });
    fireEvent.click(httpOption);

    // AuthType should reset to NONE
    await waitFor(() => {
      expect(screen.queryByLabelText(/Username|Felhasználónév/i)).not.toBeInTheDocument();
    });
  });
});
