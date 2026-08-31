import 'reflect-metadata';
import { injectable } from 'inversify';
import type { IHttpClient } from '../../types/HttpClient.interface.js';

/**
 * No-op `IHttpClient` for local dev/demo without a live backend.
 *
 * Bound by `src/di/container.ts` in place of `AxiosClient` only when
 * `VITE_USE_MOCK_CLIENT=true` is set. Every call resolves an empty payload.
 */
@injectable()
export class MockHttpClient implements IHttpClient {
  get<T>(_1: string, _2?: Record<string, string>): Promise<T> {
    return Promise.resolve({} as T);
  }

  post<T>(_1: string, _2?: unknown, _3?: Record<string, string>): Promise<T> {
    return Promise.resolve({} as T);
  }

  put<T>(_1: string, _2?: unknown, _3?: Record<string, string>): Promise<T> {
    return Promise.resolve({} as T);
  }

  delete<T>(_1: string, _2?: Record<string, string>): Promise<T> {
    return Promise.resolve({} as T);
  }
}
