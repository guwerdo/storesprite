import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import type { IHttpClient } from '../../types/HttpClient.interface.js';
import type { IMappingService } from '../../types/stocksprite/MappingService.interface.js';
import type {
  ICreateMappingPayload,
  IUpdateMappingPayload,
  IMappingsApiResponse,
  IMappingMutationResponse,
  IMappingRulesResponse,
  IMappingHistoryResponse,
} from '../../types/stocksprite/Mapping.interface.js';
import { TYPES } from '../../di/types.js';

@injectable()
export class MappingService implements IMappingService {
  constructor(
    @inject(TYPES.IHttpClient)
    private readonly _httpClient: IHttpClient
  ) {}

  public async getMappings(token: string): Promise<IMappingsApiResponse> {
    return this._httpClient.get<IMappingsApiResponse>('/client/stocksprite/mappings', {
      Authorization: `Bearer ${token}`,
    });
  }

  public async createMapping(token: string, payload: ICreateMappingPayload): Promise<IMappingMutationResponse> {
    return this._httpClient.post<IMappingMutationResponse>('/client/stocksprite/mappings', payload, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async updateMapping(token: string, id: string, payload: IUpdateMappingPayload): Promise<IMappingMutationResponse> {
    return this._httpClient.put<IMappingMutationResponse>(`/client/stocksprite/mappings/${id}`, payload, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async deleteMapping(token: string, id: string): Promise<IMappingMutationResponse> {
    return this._httpClient.delete<IMappingMutationResponse>(`/client/stocksprite/mappings/${id}`, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async getRules(token: string): Promise<IMappingRulesResponse> {
    return this._httpClient.get<IMappingRulesResponse>('/client/stocksprite/mappings/rules', {
      Authorization: `Bearer ${token}`,
    });
  }

  public async runMapping(token: string, id: string): Promise<{ success: boolean }> {
    return this._httpClient.post<{ success: boolean }>(`/client/stocksprite/mappings/${id}/run`, {}, {
      Authorization: `Bearer ${token}`,
    });
  }

  public async getHistory(token: string, id: string): Promise<IMappingHistoryResponse> {
    return this._httpClient.get<IMappingHistoryResponse>(`/client/stocksprite/mappings/${id}/history`, {
      Authorization: `Bearer ${token}`,
    });
  }
}
