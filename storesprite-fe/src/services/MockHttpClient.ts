import 'reflect-metadata';
import { injectable } from 'inversify';
import type { IHttpClient } from '../types/HttpClient.interface.js';

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
