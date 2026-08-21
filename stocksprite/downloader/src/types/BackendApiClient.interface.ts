import { DataConnectionDto } from "./Connection.types.js";

export interface IBackendApiClient {
  getUserConnections(userId: string): Promise<DataConnectionDto[]>;
}
