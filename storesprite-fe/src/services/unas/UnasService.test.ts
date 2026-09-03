import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { UnasService } from './UnasService.js';
import type { IHttpClient } from '../../types/HttpClient.interface.js';
import type { IUnasLoginResponse } from '../../types/unas/UnasConnection.interface.js';

describe('UnasService', () => {
  let mockHttpClient: ReturnType<typeof mock<IHttpClient>>;
  let unasService: UnasService;

  beforeEach(() => {
    mockHttpClient = mock<IHttpClient>();
    unasService = new UnasService(mockHttpClient);
  });

  it('calls POST /client/unas/login with empty body and Bearer token', async () => {
    // Arrange
    const responseData: IUnasLoginResponse = {
      connection: {
        checkedAt: '2026-08-26T12:00:00.000Z',
        permissions: ['getOrder'],
        webshopInfo: { webshopName: 'Test Webshop' },
      },
    };
    mockHttpClient.post.mockResolvedValue(responseData);

    // Act
    const result = await unasService.login('jwt_token_123');

    // Assert
    expect(mockHttpClient.post).toHaveBeenCalledWith('/client/unas/login', {}, {
      Authorization: 'Bearer jwt_token_123',
    });
    expect(result).toEqual(responseData);
  });
});
