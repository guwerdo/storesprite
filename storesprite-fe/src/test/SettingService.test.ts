import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingService } from '../services/SettingService.js';
import type { IHttpClient } from '../types/HttpClient.interface.js';
import type { ISettingsApiResponse } from '../types/Setting.interface.js';

describe('SettingService', () => {
  let getSpy: ReturnType<typeof vi.fn>;
  let putSpy: ReturnType<typeof vi.fn>;
  let mockHttpClient: IHttpClient;
  let settingService: SettingService;

  beforeEach(() => {
    getSpy = vi.fn();
    putSpy = vi.fn();
    mockHttpClient = {
      get: getSpy,
      post: vi.fn(),
      put: putSpy,
      delete: vi.fn(),
    };
    settingService = new SettingService(mockHttpClient);
  });

  it('calls GET /client/settings with Bearer token', async () => {
    // Arrange
    const responseData: ISettingsApiResponse = {
      settings: { unasApiKey: 'my_key', languageId: 1 },
      languages: [{ id: 1, code: 'en' }, { id: 2, code: 'hu' }],
    };
    getSpy.mockResolvedValue(responseData);

    // Act
    const result = await settingService.getSettings('jwt_token_123');

    // Assert
    expect(getSpy).toHaveBeenCalledWith('/client/settings', {
      Authorization: 'Bearer jwt_token_123',
    });
    expect(result).toEqual(responseData);
  });

  it('calls PUT /client/settings with Bearer token and payload', async () => {
    // Arrange
    const saveResponse = { success: true };
    putSpy.mockResolvedValue(saveResponse);

    // Act
    const result = await settingService.saveSettings('jwt_token_123', {
      unasApiKey: 'new_api_key',
      languageId: 2,
    });

    // Assert
    expect(putSpy).toHaveBeenCalledWith(
      '/client/settings',
      { unasApiKey: 'new_api_key', languageId: 2 },
      { Authorization: 'Bearer jwt_token_123' },
    );
    expect(result).toEqual(saveResponse);
  });
});
