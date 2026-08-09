import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Container } from 'inversify';
import { ContainerProvider } from '../di/ContainerProvider.js';
import { TYPES } from '../di/types.js';
import type { ISettingService } from '../types/SettingService.interface.js';
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

describe('SettingsPage', () => {
  let getSettingsSpy: ReturnType<typeof vi.fn>;
  let saveSettingsSpy: ReturnType<typeof vi.fn>;
  let mockSettingService: ISettingService;
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

    mockSettingService = {
      getSettings: getSettingsSpy,
      saveSettings: saveSettingsSpy,
    };

    testContainer = new Container();
    testContainer.bind<ISettingService>(TYPES.ISettingService).toConstantValue(mockSettingService);
  });

  it('renders loaded user settings and language options', async () => {
    // Act
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <SettingsPage />
        </ContainerProvider>
      </I18nProvider>,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByDisplayValue('initial_unas_key')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://api.unas.eu/shop/')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 1, name: /Settings|Beállítások/i })).toBeInTheDocument();
  });

  it('saves settings and displays success toast', async () => {
    // Arrange
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <SettingsPage />
        </ContainerProvider>
      </I18nProvider>,
    );

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
      });
      expect(
        screen.getByText(/user settings saved|felhasználói beállítások sikeresen mentve/i),
      ).toBeInTheDocument();
    });
  });

  it('validates UNAS API endpoint URL and prevents saving when invalid', async () => {
    // Arrange
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <SettingsPage />
        </ContainerProvider>
      </I18nProvider>,
    );

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
    saveSettingsSpy.mockRejectedValueOnce(new Error('API error'));

    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <SettingsPage />
        </ContainerProvider>
      </I18nProvider>,
    );

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
  });

  it('masks UNAS API key by default and reveals it when eye icon button is clicked', async () => {
    // Arrange
    render(
      <I18nProvider>
        <ContainerProvider container={testContainer}>
          <SettingsPage />
        </ContainerProvider>
      </I18nProvider>,
    );

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
});
