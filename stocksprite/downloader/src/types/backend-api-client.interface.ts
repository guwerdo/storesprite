import { DataConnectionDto, ConnectionTestResult } from "./connection.types.js";

export interface IBackendApiClient {
  getConnectionById(connectionId: string): Promise<DataConnectionDto>;
  reportTestResult(connectionId: string, result: Partial<ConnectionTestResult>): Promise<void>;
  reportRunError(mappingId: string, runId: string, error: string): Promise<void>;
}
