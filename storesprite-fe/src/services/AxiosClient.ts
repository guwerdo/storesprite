import 'reflect-metadata';
import { injectable } from 'inversify';
import axios, { type AxiosInstance } from 'axios';
import type { IHttpClient } from '../types/HttpClient.interface.js';

@injectable()
export class AxiosClient implements IHttpClient {
  private readonly _client: AxiosInstance;

  constructor() {
    this._client = axios.create({
      baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api',
    });
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await this._client.get<T>(url, { headers });
    return response.data;
  }

  async post<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this._client.post<T>(url, data, { headers });
    return response.data;
  }

  async put<T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this._client.put<T>(url, data, { headers });
    return response.data;
  }

  async delete<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await this._client.delete<T>(url, { headers });
    return response.data;
  }
}
