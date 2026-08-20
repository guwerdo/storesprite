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
} from '../types/DataConnection.interface.js';
import { TYPES } from '../di/types.js';

@injectable()
export class ConnectionService implements IConnectionService {
  constructor(
    @inject(TYPES.IHttpClient)
    private readonly _httpClient: IHttpClient
  ) {}

  public async getConnections(token: string): Promise<IConnectionsApiResponse> {
    return this._httpClient.get<IConnectionsApiResponse>('/client/connections', {
      Authorization: `Bearer ${token}`,
    });
  }

  public async getConnection(token: string, id: string): Promise<IConnectionApiResponse> {
    return this._httpClient.get<IConnectionApiResponse>(`/client/connections/${id}`, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async createConnection(token: string, payload: ICreateConnectionPayload): Promise<IConnectionMutationResponse> {
    return this._httpClient.post<IConnectionMutationResponse>('/client/connections', payload, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async updateConnection(
    token: string,
    id: string,
    payload: IUpdateConnectionPayload
  ): Promise<IConnectionMutationResponse> {
    return this._httpClient.put<IConnectionMutationResponse>(`/client/connections/${id}`, payload, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async deleteConnection(token: string, id: string): Promise<IConnectionMutationResponse> {
    return this._httpClient.delete<IConnectionMutationResponse>(`/client/connections/${id}`, {
      Authorization: `Bearer ${token}`,
    });
  }
}
