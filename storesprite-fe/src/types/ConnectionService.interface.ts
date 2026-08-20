import type {
  ICreateConnectionPayload,
  IUpdateConnectionPayload,
  IConnectionsApiResponse,
  IConnectionApiResponse,
  IConnectionMutationResponse,
} from './DataConnection.interface.js';

export interface IConnectionService {
  getConnections(token: string): Promise<IConnectionsApiResponse>;
  getConnection(token: string, id: string): Promise<IConnectionApiResponse>;
  createConnection(token: string, payload: ICreateConnectionPayload): Promise<IConnectionMutationResponse>;
  updateConnection(token: string, id: string, payload: IUpdateConnectionPayload): Promise<IConnectionMutationResponse>;
  deleteConnection(token: string, id: string): Promise<IConnectionMutationResponse>;
}
