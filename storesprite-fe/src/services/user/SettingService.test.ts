import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingService } from './SettingService.js';
import { ConnectionService } from '../../services/stocksprite/ConnectionService.js';
import type { IHttpClient } from '../../types/HttpClient.interface.js';
import type { ISettingsApiResponse } from '../../types/user/Setting.interface.js';
import type {
  IConnectionsApiResponse,
} from '../../types/stocksprite/DataConnection.interface.js';

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

describe('ConnectionService', () => {
  let getSpy: ReturnType<typeof vi.fn>;
  let postSpy: ReturnType<typeof vi.fn>;
  let putSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;
  let mockHttpClient: IHttpClient;
  let connectionService: ConnectionService;

  beforeEach(() => {
    getSpy = vi.fn();
    postSpy = vi.fn();
    putSpy = vi.fn();
    deleteSpy = vi.fn();
    mockHttpClient = {
      get: getSpy,
      post: postSpy,
      put: putSpy,
      delete: deleteSpy,
    };
    connectionService = new ConnectionService(mockHttpClient);
  });

  it('calls GET /client/stocksprite/connections with Bearer token', async () => {
    // Arrange
    const responseData: IConnectionsApiResponse = {
      connections: [
        {
          id: 'conn_1',
          name: 'Supplier CSV',
          channel: 'HTTP',
          dataFormat: 'CSV',
          isActive: true,
          config: { channel: 'HTTP', url: 'https://example.com/test.csv', method: 'GET' },
          dataFormatConfig: { format: 'CSV', delimiter: ';' },
          credentials: { authType: 'NONE' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    getSpy.mockResolvedValue(responseData);

    // Act
    const result = await connectionService.getConnections('jwt_token_123');

    // Assert
    expect(getSpy).toHaveBeenCalledWith('/client/stocksprite/connections', {
      Authorization: 'Bearer jwt_token_123',
    });
    expect(result).toEqual(responseData);
  });

  it('calls POST /client/stocksprite/connections/:id/run-test with Bearer token', async () => {
    // Arrange
    postSpy.mockResolvedValue(undefined);

    // Act
    await connectionService.runTest('jwt_token_123', 'conn_test_id');

    // Assert
    expect(postSpy).toHaveBeenCalledWith(
      '/client/stocksprite/connections/conn_test_id/run-test',
      {},
      { Authorization: 'Bearer jwt_token_123' },
    );
  });

  it('calls GET /client/stocksprite/connections/:id/test-result with Bearer token', async () => {
    // Arrange
    const resultPayload = {
      testResult: {
        success: true,
        progress: 'finish' as const,
        duration_ms: 1250,
        rowCount: 50,
        columnCount: 4,
        columns: ['sku', 'name', 'price', 'stock'],
        rows: [['A1', 'Prod 1', '100', '10']],
      },
    };
    getSpy.mockResolvedValue(resultPayload);

    // Act
    const result = await connectionService.getTestResult('jwt_token_123', 'conn_test_id');

    // Assert
    expect(getSpy).toHaveBeenCalledWith('/client/stocksprite/connections/conn_test_id/test-result', {
      Authorization: 'Bearer jwt_token_123',
    });
    expect(result).toEqual(resultPayload);
  });

  it('calls DELETE /client/stocksprite/connections/:id/test-result with Bearer token', async () => {
    // Arrange
    deleteSpy.mockResolvedValue(undefined);

    // Act
    await connectionService.invalidateConnection('jwt_token_123', 'conn_test_id');

    // Assert
    expect(deleteSpy).toHaveBeenCalledWith(
      '/client/stocksprite/connections/conn_test_id/test-result',
      { Authorization: 'Bearer jwt_token_123' },
    );
  });
});


