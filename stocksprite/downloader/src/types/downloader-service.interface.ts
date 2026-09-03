import { DataConnectionChannel, DataConnectionFormat } from "./connection.types.js";

export interface ConnectionProcessResult {
  connectionId: string;
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  status: "OK" | "ERROR" | "SKIPPED";
  isUnchanged?: boolean;
  error?: string;
  rawFilePath?: string;
  csvFilePath?: string;
}

export interface DownloaderExecutionSummary {
  userId: string;
  totalConnections: number;
  activeConnections: number;
  successCount: number;
  errorCount: number;
  results: ConnectionProcessResult[];
}

export interface IDownloaderService {
  run(): Promise<DownloaderExecutionSummary>;
}
