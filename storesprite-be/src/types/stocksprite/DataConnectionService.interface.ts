import {
  DataConnectionDto,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
  ConnectionTestResult,
} from "./DataConnectionRepository.interface.js";

export interface IDataConnectionService {
  getConnections(userId: string): Promise<DataConnectionDto[]>;
  getConnectionById(id: string, userId: string): Promise<DataConnectionDto | null>;
  createConnection(userId: string, connectionDto: CreateDataConnectionDto): Promise<DataConnectionDto>;
  updateConnection(id: string, userId: string, connectionDto: UpdateDataConnectionDto): Promise<DataConnectionDto | null>;
  deleteConnection(id: string, userId: string): Promise<boolean>;
  invalidateConnection(id: string, userId: string): Promise<boolean>;
  saveTestResult(id: string, testResult: Partial<ConnectionTestResult>): Promise<DataConnectionDto | null>;
  getConnectionByIdForWorker(id: string): Promise<DataConnectionDto | null>;
}
