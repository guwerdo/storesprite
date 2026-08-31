import type {
  ICreateConnectionPayload,
  IUpdateConnectionPayload,
  IConnectionsApiResponse,
  IConnectionApiResponse,
  IConnectionMutationResponse,
  IConnectionTestResultResponse,
} from './DataConnection.interface.js';

export interface IConnectionService {
  getConnections(token: string): Promise<IConnectionsApiResponse>;
  getConnection(token: string, id: string): Promise<IConnectionApiResponse>;
  createConnection(token: string, payload: ICreateConnectionPayload): Promise<IConnectionMutationResponse>;
  updateConnection(token: string, id: string, payload: IUpdateConnectionPayload): Promise<IConnectionMutationResponse>;
  deleteConnection(token: string, id: string): Promise<IConnectionMutationResponse>;
  runTest(token: string, id: string): Promise<void>;
  getTestResult(token: string, id: string): Promise<IConnectionTestResultResponse>;
  invalidateConnection(token: string, id: string): Promise<void>;
}
