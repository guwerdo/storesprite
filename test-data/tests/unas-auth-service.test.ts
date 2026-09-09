import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { UnasAuthService } from '../src/services/unas-auth-service.js';

describe('UnasAuthService', () => {
  let tempDir: string;
  let apiKeyPath: string;
  let tokenPath: string;

  let originalUnasApiKey: string | undefined;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalUnasApiKey = process.env.UNAS_API_KEY;
    originalApiKey = process.env.API_KEY;
    delete process.env.UNAS_API_KEY;
    delete process.env.API_KEY;

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unas-auth-test-'));
    apiKeyPath = path.join(tempDir, 'unas-api-key');
    tokenPath = path.join(tempDir, 'unas-api-token');
    fs.writeFileSync(apiKeyPath, 'test-api-key-12345', 'utf-8');
  });

  afterEach(() => {
    if (originalUnasApiKey !== undefined) {
      process.env.UNAS_API_KEY = originalUnasApiKey;
    } else {
      delete process.env.UNAS_API_KEY;
    }
    if (originalApiKey !== undefined) {
      process.env.API_KEY = originalApiKey;
    } else {
      delete process.env.API_KEY;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });


  it('should return the cached token if it is less than 1 hour old without calling fetch', async () => {
    const recentCreatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins old
    fs.writeFileSync(tokenPath, JSON.stringify({ token: 'cached-token-123', createdAt: recentCreatedAt }), 'utf-8');

    const fetchMock = vi.fn();
    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const token = await service.getValidToken();

    expect(token).toBe('cached-token-123');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should fetch and cache a new token if cached token is older than 1 hour', async () => {
    const expiredCreatedAt = new Date(Date.now() - 65 * 60 * 1000).toISOString(); // 65 mins old
    fs.writeFileSync(tokenPath, JSON.stringify({ token: 'expired-token', createdAt: expiredCreatedAt }), 'utf-8');

    const mockResponseXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Login>
    <Token>new-live-token-777</Token>
    <Status>ok</Status>
</Login>`;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(mockResponseXml),
    });

    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const token = await service.getValidToken();

    expect(token).toBe('new-live-token-777');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify written token file
    const savedContent = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    expect(savedContent.token).toBe('new-live-token-777');
    expect(new Date(savedContent.createdAt).getTime()).toBeGreaterThan(0);
  });

  it('should fetch and cache a new token if token file does not exist', async () => {
    const mockResponseXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Login>
    <Token>brand-new-token-888</Token>
    <Status>ok</Status>
</Login>`;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(mockResponseXml),
    });

    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const token = await service.getValidToken();

    expect(token).toBe('brand-new-token-888');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.unas.eu/shop/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        body: expect.stringContaining('<ApiKey>test-api-key-12345</ApiKey>'),
      })
    );
  });

  it('should parse custom date format YYYY-MM-DD-HH:mm correctly when checking cache', async () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const h = String(now.getUTCHours()).padStart(2, '0');
    const min = String(now.getUTCMinutes()).padStart(2, '0');
    const customDateStr = `${y}-${m}-${d}-${h}:${min}`;

    fs.writeFileSync(tokenPath, JSON.stringify({ token: 'custom-date-token', createdAt: customDateStr }), 'utf-8');

    const fetchMock = vi.fn();
    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const token = await service.getValidToken();

    expect(token).toBe('custom-date-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should use UNAS_API_KEY environment variable when available', async () => {
    process.env.UNAS_API_KEY = 'env-api-key-999';
    fs.rmSync(apiKeyPath); // Ensure file does not exist

    const mockResponseXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Login>
    <Token>env-token-success</Token>
    <Status>ok</Status>
</Login>`;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(mockResponseXml),
    });

    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const token = await service.getValidToken();

    expect(token).toBe('env-token-success');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.unas.eu/shop/login',
      expect.objectContaining({
        body: expect.stringContaining('<ApiKey>env-api-key-999</ApiKey>'),
      })
    );

    delete process.env.UNAS_API_KEY;
  });

  it('should throw an error if the API key is not in env and file does not exist', async () => {
    delete process.env.UNAS_API_KEY;
    delete process.env.API_KEY;
    fs.rmSync(apiKeyPath);

    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
    });

    await expect(service.getValidToken()).rejects.toThrow(/UNAS API Key not found/i);
  });

  it('should throw an error if UNAS responds with an error status XML', async () => {
    const errorXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Login>
    <Status>error</Status>
    <Error>Invalid ApiKey</Error>
</Login>`;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(errorXml),
    });

    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await expect(service.getValidToken()).rejects.toThrow(/UNAS login rejected: Invalid ApiKey/);
  });

  it('should return correct Authorization bearer headers', async () => {
    const recentCreatedAt = new Date().toISOString();
    fs.writeFileSync(tokenPath, JSON.stringify({ token: 'auth-header-token', createdAt: recentCreatedAt }), 'utf-8');

    const service = new UnasAuthService({
      apiKeyFilePath: apiKeyPath,
      tokenFilePath: tokenPath,
    });

    const headers = await service.getAuthHeaders();
    expect(headers).toEqual({ Authorization: 'Bearer auth-header-token' });
  });
});

