export type DataConnectionChannel = 'HTTP' | 'SFTP';
export type DataConnectionFormat = 'CSV' | 'XML';

// Transport Layer (config)
export interface HttpConnectionConfig {
  channel: 'HTTP';
  url: string;
  method?: 'GET' | 'POST';
  insecureIgnoreSsl?: boolean;
  timeoutSeconds?: number;
}

export interface SftpConnectionConfig {
  channel: 'SFTP';
  host: string;
  port?: number;
  remoteDir: string;
  fileSelectionStrategy?: 'LATEST_ALPHABETICAL' | 'LATEST_MODIFIED' | 'EXACT_MATCH';
}

export type ConnectionConfig = HttpConnectionConfig | SftpConnectionConfig;

// Parser Layer (data_format_config)
export interface CsvDataFormatConfig {
  format: 'CSV';
  delimiter: string;
  encoding?: string;
  hasHeaders?: boolean;
}

export interface XmlDataFormatConfig {
  format: 'XML';
  rowPath: string;
  includeAttributes?: boolean;
  attributePrefix?: string;
}

export type DataFormatConfig = CsvDataFormatConfig | XmlDataFormatConfig;

export interface IDataConnection {
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

export interface ICreateConnectionPayload {
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  config: ConnectionConfig;
  dataFormatConfig: DataFormatConfig;
  isActive?: boolean;
  credentials?: Record<string, unknown> | null;
}

export interface IUpdateConnectionPayload {
  name?: string;
  channel?: DataConnectionChannel;
  dataFormat?: DataConnectionFormat;
  config?: ConnectionConfig;
  dataFormatConfig?: DataFormatConfig;
  isActive?: boolean;
  credentials?: Record<string, unknown> | null;
}

export interface IConnectionsApiResponse {
  connections: IDataConnection[];
}

export interface IConnectionApiResponse {
  connection: IDataConnection;
}

export interface IConnectionMutationResponse {
  success: boolean;
  connection?: IDataConnection;
  message?: string;
  error?: string;
}
