import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UnasTokenData } from '../models/types.js';

export interface UnasAuthServiceOptions {
  apiKey?: string;
  apiKeyFilePath?: string;
  tokenFilePath?: string;
  loginUrl?: string;
  tokenTtlMs?: number;
  fetchFn?: typeof fetch;
}

export class UnasAuthService {
  private readonly _explicitApiKey?: string;
  private readonly _apiKeyFilePath: string;
  private readonly _tokenFilePath: string;
  private readonly _loginUrl: string;
  private readonly _tokenTtlMs: number;
  private readonly _fetchFn: typeof fetch;

  public constructor(options: UnasAuthServiceOptions = {}) {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const defaultBaseDir = path.resolve(currentDir, '../../');

    this._explicitApiKey = options.apiKey;
    this._apiKeyFilePath = options.apiKeyFilePath ?? path.join(defaultBaseDir, 'unas-api-key');
    this._tokenFilePath = options.tokenFilePath ?? path.join(defaultBaseDir, 'unas-api-token');
    this._loginUrl = options.loginUrl ?? 'https://api.unas.eu/shop/login';
    this._tokenTtlMs = options.tokenTtlMs ?? 60 * 60 * 1000; // 1 hour
    this._fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  public async getValidToken(): Promise<string> {
    const cachedToken = this.readCachedToken();
    if (cachedToken) {
      return cachedToken;
    }

    const apiKey = this.getApiKey();
    const newToken = await this.requestNewToken(apiKey);
    this.saveToken(newToken);
    return newToken;
  }

  public async getAuthHeaders(): Promise<{ Authorization: string }> {
    const token = await this.getValidToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private readCachedToken(): string | null {
    if (!fs.existsSync(this._tokenFilePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this._tokenFilePath, 'utf-8').trim();
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as Partial<UnasTokenData>;
      if (!parsed.token || !parsed.createdAt) {
        return null;
      }

      const createdAtMs = this.parseDateToTimestamp(parsed.createdAt);
      if (Number.isNaN(createdAtMs)) {
        return null;
      }

      const ageMs = Date.now() - createdAtMs;
      if (ageMs >= 0 && ageMs < this._tokenTtlMs) {
        return parsed.token;
      }

      return null;
    } catch {
      return null;
    }
  }

  private getApiKey(): string {
    if (this._explicitApiKey && this._explicitApiKey.trim()) {
      return this._explicitApiKey.trim();
    }

    const envApiKey = process.env.UNAS_API_KEY || process.env.API_KEY;
    if (envApiKey && envApiKey.trim()) {
      return envApiKey.trim();
    }

    if (fs.existsSync(this._apiKeyFilePath)) {
      const fileApiKey = fs.readFileSync(this._apiKeyFilePath, 'utf-8').trim();
      if (fileApiKey) {
        return fileApiKey;
      }
    }

    throw new Error(
      `UNAS API Key not found. Please provide UNAS_API_KEY environment variable or populate key file at: ${this._apiKeyFilePath}`
    );
  }

  private async requestNewToken(apiKey: string): Promise<string> {
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" ?>\n<Params>\n    <ApiKey>${apiKey}</ApiKey>\n</Params>`;

    let response: Response;
    try {
      response = await this._fetchFn(this._loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
        },
        body: xmlPayload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to communicate with UNAS login endpoint (${this._loginUrl}): ${message}`);
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`UNAS login request failed with HTTP ${response.status}: ${responseText}`);
    }

    const token = this.extractXmlTag(responseText, 'Token');
    const status = this.extractXmlTag(responseText, 'Status');

    if (status && status.toLowerCase() === 'error') {
      const errorMsg = this.extractXmlTag(responseText, 'Error') ?? 'Unknown UNAS error';
      throw new Error(`UNAS login rejected: ${errorMsg}`);
    }

    if (!token) {
      throw new Error(`No <Token> element found in UNAS login response: ${responseText}`);
    }

    return token;
  }

  private saveToken(token: string): void {
    const tokenData: UnasTokenData = {
      token,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(this._tokenFilePath, JSON.stringify(tokenData, null, 2), 'utf-8');
  }

  private parseDateToTimestamp(dateStr: string): number {
    const standardTimestamp = Date.parse(dateStr);
    if (!Number.isNaN(standardTimestamp)) {
      return standardTimestamp;
    }

    // Support "YYYY-MM-DD-HH:mm" custom format if present
    const customMatch = /^(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2})$/.exec(dateStr);
    if (customMatch) {
      const [, y, m, d, h, min] = customMatch;
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min))).getTime();
    }

    return Number.NaN;
  }

  private extractXmlTag(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
    const match = regex.exec(xml);
    return match ? match[1].trim() : null;
  }
}
