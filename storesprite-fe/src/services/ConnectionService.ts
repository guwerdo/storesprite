import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import type { IHttpClient } from '../types/HttpClient.interface.js';
import type { IConnectionService } from '../types/ConnectionService.interface.js';
import type {
  ICreateConnectionPayload,
  IUpdateConnectionPayload,
  IConnectionsApiResponse,
  IConnectionApiResponse,
  IConnectionMutationResponse,
  IConnectionTestResultResponse,
} from '../types/DataConnection.interface.js';
import { TYPES } from '../di/types.js';

@injectable()
export class ConnectionService implements IConnectionService {
  constructor(
    @inject(TYPES.IHttpClient)
    private readonly _httpClient: IHttpClient
  ) {}

  public async getConnections(token: string): Promise<IConnectionsApiResponse> {
    return this._httpClient.get<IConnectionsApiResponse>('/client/stocksprite/connections', {
      Authorization: `Bearer ${token}`,
    });
  }

  public async getConnection(token: string, id: string): Promise<IConnectionApiResponse> {
    return this._httpClient.get<IConnectionApiResponse>(`/client/stocksprite/connections/${id}`, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async createConnection(token: string, payload: ICreateConnectionPayload): Promise<IConnectionMutationResponse> {
    return this._httpClient.post<IConnectionMutationResponse>('/client/stocksprite/connections', payload, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async updateConnection(
    token: string,
    id: string,
    payload: IUpdateConnectionPayload
  ): Promise<IConnectionMutationResponse> {
    return this._httpClient.put<IConnectionMutationResponse>(`/client/stocksprite/connections/${id}`, payload, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async deleteConnection(token: string, id: string): Promise<IConnectionMutationResponse> {
    return this._httpClient.delete<IConnectionMutationResponse>(`/client/stocksprite/connections/${id}`, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async runTest(token: string, id: string): Promise<void> {
    await this._httpClient.post(`/client/stocksprite/connections/${id}/run-test`, {}, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async getTestResult(token: string, id: string): Promise<IConnectionTestResultResponse> {
    return this._httpClient.get<IConnectionTestResultResponse>(`/client/stocksprite/connections/${id}/test-result`, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async invalidateConnection(token: string, id: string): Promise<void> {
    await this._httpClient.delete(`/client/stocksprite/connections/${id}/test-result`, {
      Authorization: `Bearer ${token}`,
    });
  }
}
