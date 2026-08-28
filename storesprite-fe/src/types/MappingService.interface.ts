import type {
  ICreateMappingPayload,
  IUpdateMappingPayload,
  IMappingsApiResponse,
  IMappingApiResponse,
  IMappingMutationResponse,
  IMappingRulesResponse,
} from './Mapping.interface.js';

export interface IMappingService {
  getMappings(token: string): Promise<IMappingsApiResponse>;
  getMapping(token: string, id: string): Promise<IMappingApiResponse>;
  createMapping(token: string, payload: ICreateMappingPayload): Promise<IMappingMutationResponse>;
  updateMapping(token: string, id: string, payload: IUpdateMappingPayload): Promise<IMappingMutationResponse>;
  deleteMapping(token: string, id: string): Promise<IMappingMutationResponse>;
  getRules(token: string): Promise<IMappingRulesResponse>;
}
