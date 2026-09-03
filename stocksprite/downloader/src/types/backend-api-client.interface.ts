import { DataConnectionDto, ConnectionTestResult } from "./connection.types.js";

export interface IBackendApiClient {
  getUserConnections(userId: string): Promise<DataConnectionDto[]>;
  getConnectionById(connectionId: string): Promise<DataConnectionDto>;
  reportTestResult(connectionId: string, result: Partial<ConnectionTestResult>): Promise<void>;
}
