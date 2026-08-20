import { DataConnection, DataConnectionChannel, DataConnectionFormat } from "../entities/DataConnection.js";

// Transport Layer Config
export interface HttpConnectionConfig {
  channel: "HTTP";
  url: string;
  method?: "GET" | "POST";
  insecureIgnoreSsl?: boolean;
  timeoutSeconds?: number;
}

export interface SftpConnectionConfig {
  channel: "SFTP";
  host: string;
  port?: number;
  remoteDir: string;
  fileSelectionStrategy?: "LATEST_ALPHABETICAL" | "LATEST_MODIFIED" | "EXACT_MATCH";
}

export type ConnectionConfig = HttpConnectionConfig | SftpConnectionConfig;

// Parser Layer Config
export interface CsvDataFormatConfig {
  format: "CSV";
  delimiter: string;
  encoding?: string;
  hasHeaders?: boolean;
}

export interface XmlDataFormatConfig {
  format: "XML";
  rowPath: string;
  includeAttributes?: boolean;
  attributePrefix?: string;
}

export type DataFormatConfig = CsvDataFormatConfig | XmlDataFormatConfig;

export interface DataConnectionDto {
  id: string;
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  config: ConnectionConfig;
  dataFormatConfig: DataFormatConfig;
  isActive: boolean;
  credentials?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataConnectionDto {
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  config: ConnectionConfig;
  dataFormatConfig: DataFormatConfig;
  isActive?: boolean;
  credentials?: Record<string, unknown> | null;
}

export interface UpdateDataConnectionDto {
  name?: string;
  channel?: DataConnectionChannel;
  dataFormat?: DataConnectionFormat;
  config?: ConnectionConfig;
  dataFormatConfig?: DataFormatConfig;
  isActive?: boolean;
  credentials?: Record<string, unknown> | null;
}

export interface IDataConnectionRepository {
  getAllByUserId(userId: string): Promise<DataConnection[]>;
  getByIdAndUserId(id: string, userId: string): Promise<DataConnection | null>;
  create(userId: string, data: CreateDataConnectionDto): Promise<DataConnection>;
  update(id: string, userId: string, data: UpdateDataConnectionDto): Promise<DataConnection | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
