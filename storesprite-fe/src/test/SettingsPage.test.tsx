import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Container } from 'inversify';
import { ContainerProvider } from '../di/ContainerProvider.js';
import { TYPES } from '../di/types.js';
import type { ISettingService } from '../types/SettingService.interface.js';
import type { IUnasService } from '../types/UnasService.interface.js';
import type { IUnasConnection } from '../types/UnasConnection.interface.js';
import SettingsPage from '../features/settings/SettingsPage.js';
import { I18nProvider } from '../i18n/I18nProvider.js';

const mockGetToken = vi.fn().mockResolvedValue('test_token');

// Mock @clerk/clerk-react useAuth hook
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: mockGetToken,
  }),
}));

const makeConnection = (overrides: Partial<IUnasConnection> = {}): IUnasConnection => ({
  checkedAt: '2026-08-26T12:00:00.000Z',
  permissions: ['getOrder', 'setPackageOffer'],
  webshopInfo: { webshopName: 'Test Webshop' },
  ...overrides,
});

describe('SettingsPage', () => {
  let getSettingsSpy: ReturnType<typeof vi.fn>;
  let saveSettingsSpy: ReturnType<typeof vi.fn>;
  let loginSpy: ReturnType<typeof vi.fn>;
  let mockSettingService: ISettingService;
  let mockUnasService: IUnasService;
  let testContainer: Container;

  beforeEach(() => {
    getSettingsSpy = vi.fn().mockResolvedValue({
      settings: {
        unasApiKey: 'initial_unas_key',
        unasApiEndpoint: 'https://api.unas.eu/shop/',
        languageId: 2,
      },
      languages: [
        { id: 1, code: 'en' },
        { id: 2, code: 'hu' },
      ],
    });
    saveSettingsSpy = vi.fn().mockResolvedValue({ success: true });
    loginSpy = vi.fn().mockResolvedValue({ connection: makeConnection() });

    mockSettingService = {
      getSettings: getSettingsSpy,
      saveSettings: saveSettingsSpy,
    };
    mockUnasService = {
      login: loginSpy,
      getWarehouses: vi.fn().mockResolvedValue({ warehouses: [] }),
    };

    testContainer = new Container();
    testContainer.bind<ISettingService>(TYPES.ISettingService).toConstantValue(mockSettingService);
    testContainer.bind<IUnasService>(TYPES.IUnasService).toConstantValue(mockUnasService);
  });

  const renderSettingsPage = () =>
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <SettingsPage />
        </ContainerProvider>
      </I18nProvider>,
    );

  it('renders loaded user settings and language options', async () => {
    // Act
    renderSettingsPage();

    // Assert
    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://api.unas.eu/shop/')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 1, name: /Settings|Beállítások/i })).toBeInTheDocument();
  });

  it('saves settings and displays success toast', async () => {
    // Arrange
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
    });

    const apiKeyInput = screen.getByDisplayValue('initial_unas_key');
    fireEvent.change(apiKeyInput, { target: { value: 'updated_key' } });

    const endpointInput = screen.getByDisplayValue('https://api.unas.eu/shop/');
    fireEvent.change(endpointInput, { target: { value: 'https://custom.unas.eu/shop/' } });

    const saveButton = screen.getByRole('button', { name: /Save Settings|Beállítások mentése/i });

    // Act
    fireEvent.click(saveButton);

    // Assert
    await waitFor(() => {
      expect(saveSettingsSpy).toHaveBeenCalledWith('test_token', {
        unasApiKey: 'updated_key',
        unasApiEndpoint: 'https://custom.unas.eu/shop/',
        languageId: 2,
        timezone: 'Europe/Budapest',
      });
      expect(
        screen.getByText(/user settings saved|felhasználói beállítások sikeresen mentve/i),
      ).toBeInTheDocument();
    });
  });

  it('validates UNAS API endpoint URL and prevents saving when invalid', async () => {
    // Arrange
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://api.unas.eu/shop/')).toBeInTheDocument();
    });

    const endpointInput = screen.getByDisplayValue('https://api.unas.eu/shop/');
    const saveButton = screen.getByRole('button', { name: /Save Settings|Beállítások mentése/i });

    // Test blank validation
    fireEvent.change(endpointInput, { target: { value: '   ' } });
    fireEvent.click(saveButton);

    expect(saveSettingsSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText(/UNAS API Endpoint is required|Az UNAS API végpont megadása kötelező/i),
    ).toBeInTheDocument();

    // Test non-HTTPS validation
    fireEvent.change(endpointInput, { target: { value: 'http://insecure.endpoint.com' } });
    fireEvent.click(saveButton);

    expect(saveSettingsSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Please enter a valid HTTPS URL|Kérjük, adjon meg egy érvényes HTTPS URL-t/i),
    ).toBeInTheDocument();
  });

  it('displays error toast when saving settings fails', async () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    saveSettingsSpy.mockRejectedValueOnce(new Error('API error'));

    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Settings|Beállítások mentése/i });

    // Act
    fireEvent.click(saveButton);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByText(/saving user settings failed|mentése sikertelen/i),
      ).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('masks UNAS API key by default and reveals it when eye icon button is clicked', async () => {
    // Arrange
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
    });

    const apiKeyInput = screen.getByLabelText(/UNAS API Key|UNAS API Kulcs/i);
    expect(apiKeyInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: /show api key|megjelenítése/i });
    expect(toggleButton).toBeInTheDocument();

    // Act
    fireEvent.click(toggleButton);

    // Assert
    expect(apiKeyInput).toHaveAttribute('type', 'text');

    // Act again to toggle back
    fireEvent.click(toggleButton);
    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  it('disables the test connection button and shows a prompt when no API key is saved', async () => {
    // Arrange
    getSettingsSpy.mockResolvedValue({
      settings: { unasApiKey: '', unasApiEndpoint: 'https://api.unas.eu/shop/', languageId: 2 },
      languages: [
        { id: 1, code: 'en' },
        { id: 2, code: 'hu' },
      ],
    });

    // Act
    renderSettingsPage();

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Unas connection|UNAS kapcsolat tesztelése/i })).toBeDisabled();
    });
    expect(
      screen.getByText(/Save your settings before testing|Mentse a beállításait az UNAS kapcsolat tesztelése előtt/i),
    ).toBeInTheDocument();
  });

  it('disables the test connection button while the API key has unsaved changes', async () => {
    // Arrange
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
    });

    const apiKeyInput = screen.getByDisplayValue('initial_unas_key');
    fireEvent.change(apiKeyInput, { target: { value: 'changed_key' } });

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test Unas connection|UNAS kapcsolat tesztelése/i })).toBeDisabled();
    });
    expect(
      screen.getByText(/Save your settings before testing|Mentse a beállításait az UNAS kapcsolat tesztelése előtt/i),
    ).toBeInTheDocument();
  });

  it('calls the login endpoint and renders the connection result on success', async () => {
    // Arrange
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
    });

    const testButton = screen.getByRole('button', { name: /Test Unas connection|UNAS kapcsolat tesztelése/i });
    expect(testButton).toBeEnabled();

    // Act
    fireEvent.click(testButton);

    // Assert
    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith('test_token');
      expect(screen.getByText(/Connected to webshop: Test Webshop|Webáruházhoz csatlakozva: Test Webshop/i)).toBeInTheDocument();
      expect(screen.getByText(/Checked on:|Ellenőrizve:/i)).toBeInTheDocument();
    });
  });

  it('opens and closes the permissions dialog from the result panel', async () => {
    // Arrange
    getSettingsSpy.mockResolvedValue({
      settings: {
        unasApiKey: 'initial_unas_key',
        unasApiEndpoint: 'https://api.unas.eu/shop/',
        languageId: 2,
        unasConnection: makeConnection(),
      },
      languages: [
        { id: 1, code: 'en' },
        { id: 2, code: 'hu' },
      ],
    });

    renderSettingsPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /available permissions|elérhető jogosultságok/i }),
      ).toBeInTheDocument();
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /available permissions|elérhető jogosultságok/i }));

    // Assert
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Available Permissions|Elérhető jogosultságok/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('getOrder')).toBeInTheDocument();
      expect(screen.getByText('setPackageOffer')).toBeInTheDocument();
    });

    // Act - close dialog
    fireEvent.click(screen.getByRole('button', { name: /OK|Rendben/i }));

    // Assert
    await waitFor(() => {
      expect(screen.queryByText('getOrder')).not.toBeInTheDocument();
    });
  });

  it('shows an error toast when the connection test fails', async () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loginSpy.mockRejectedValueOnce(new Error('API error'));

    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
    });

    const testButton = screen.getByRole('button', { name: /Test Unas connection|UNAS kapcsolat tesztelése/i });

    // Act
    fireEvent.click(testButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Connection test failed|Az UNAS kapcsolat tesztelése sikertelen/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });
});
