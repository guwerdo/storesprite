import type {
  ICreateMappingPayload,
  IUpdateMappingPayload,
  IMappingsApiResponse,
  IMappingMutationResponse,
  IMappingRulesResponse,
  IMappingHistoryResponse,
} from './Mapping.interface.js';

export interface IMappingService {
  getMappings(token: string): Promise<IMappingsApiResponse>;
  createMapping(token: string, payload: ICreateMappingPayload): Promise<IMappingMutationResponse>;
  updateMapping(token: string, id: string, payload: IUpdateMappingPayload): Promise<IMappingMutationResponse>;
  deleteMapping(token: string, id: string): Promise<IMappingMutationResponse>;
  getRules(token: string): Promise<IMappingRulesResponse>;
  runMapping(token: string, id: string): Promise<{ success: boolean }>;
  getHistory(token: string, id: string): Promise<IMappingHistoryResponse>;
}
