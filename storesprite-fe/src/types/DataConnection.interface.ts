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

// Credentials (credentials)
export type HttpAuthType = 'NONE' | 'BASIC' | 'BEARER' | 'API_KEY';
export type SftpAuthType = 'PASSWORD' | 'PRIVATE_KEY';
export type ConnectionAuthType = HttpAuthType | SftpAuthType;

export interface HttpNoneCredentials {
  authType: 'NONE';
}

export interface HttpBasicCredentials {
  authType: 'BASIC';
  username: string;
  password: string;
}

export interface HttpBearerCredentials {
  authType: 'BEARER';
  token: string;
}

export interface HttpApiKeyCredentials {
  authType: 'API_KEY';
  headerName: string;
  headerValue: string;
}

export type HttpCredentials =
  | HttpNoneCredentials
  | HttpBasicCredentials
  | HttpBearerCredentials
  | HttpApiKeyCredentials;

export interface SftpPasswordCredentials {
  authType: 'PASSWORD';
  username: string;
  password: string;
}

export interface SftpPrivateKeyCredentials {
  authType: 'PRIVATE_KEY';
  username: string;
  privateKey: string;
  passphrase?: string;
}

export type SftpCredentials =
  | SftpPasswordCredentials
  | SftpPrivateKeyCredentials;

export type ConnectionCredentials = HttpCredentials | SftpCredentials;

export type ConnectionTestProgress = 'start' | 'download' | 'convert' | 'finish' | null;

export interface ConnectionTestResult {
  progress?: ConnectionTestProgress;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  success?: boolean;
  errorMessage?: string;
  rowCount?: number;
  columnCount?: number;
  fileSize?: number;
  columns?: string[];
  rows?: string[][];
}

export interface IDataConnection {
  id: string;
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  config: ConnectionConfig;
  dataFormatConfig: DataFormatConfig;
  isActive: boolean;
  credentials?: ConnectionCredentials | Record<string, unknown> | null;
  testResult?: ConnectionTestResult | null;
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
  credentials?: ConnectionCredentials | Record<string, unknown> | null;
  testResult?: ConnectionTestResult | null;
}

export interface IUpdateConnectionPayload {
  name?: string;
  channel?: DataConnectionChannel;
  dataFormat?: DataConnectionFormat;
  config?: ConnectionConfig;
  dataFormatConfig?: DataFormatConfig;
  isActive?: boolean;
  credentials?: ConnectionCredentials | Record<string, unknown> | null;
  testResult?: ConnectionTestResult | null;
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

export interface IConnectionTestResultResponse {
  testResult: ConnectionTestResult | null;
}
