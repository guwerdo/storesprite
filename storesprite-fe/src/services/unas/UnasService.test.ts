import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnasService } from './UnasService.js';
import type { IHttpClient } from '../../types/HttpClient.interface.js';
import type { IUnasLoginResponse } from '../../types/unas/UnasConnection.interface.js';

describe('UnasService', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let mockHttpClient: IHttpClient;
  let unasService: UnasService;

  beforeEach(() => {
    postSpy = vi.fn();
    mockHttpClient = {
      get: vi.fn(),
      post: postSpy,
      put: vi.fn(),
      delete: vi.fn(),
    };
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
    postSpy.mockResolvedValue(responseData);

    // Act
    const result = await unasService.login('jwt_token_123');

    // Assert
    expect(postSpy).toHaveBeenCalledWith('/client/unas/login', {}, {
      Authorization: 'Bearer jwt_token_123',
    });
    expect(result).toEqual(responseData);
  });
});
