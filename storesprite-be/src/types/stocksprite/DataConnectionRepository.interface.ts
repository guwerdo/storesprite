import { DataConnection, DataConnectionChannel, DataConnectionFormat } from "../../entities/stocksprite/DataConnection.js";

// Transport Layer Config
export interface HttpConnectionConfig {
  channel: "HTTP";
  /**
   * @pattern ^https?://
   * @minLength 1
   */
  url: string;
  method?: "GET" | "POST";
  insecureIgnoreSsl?: boolean;
  /**
   * @minimum 1
   * @maximum 300
   */
  timeoutSeconds?: number;
}

export interface SftpConnectionConfig {
  channel: "SFTP";
  /**
   * @minLength 1
   */
  host: string;
  /**
   * @minimum 1
   * @maximum 65535
   */
  port?: number;
  /**
   * @minLength 1
   */
  remoteDir: string;
  fileSelectionStrategy?: "LATEST_ALPHABETICAL" | "LATEST_MODIFIED" | "EXACT_MATCH";
}

export type ConnectionConfig = HttpConnectionConfig | SftpConnectionConfig;

// Parser Layer Config
export interface CsvDataFormatConfig {
  format: "CSV";
  /**
   * @minLength 1
   */
  delimiter: string;
  encoding?: string;
  hasHeaders?: boolean;
}

export interface XmlDataFormatConfig {
  format: "XML";
  /**
   * @minLength 1
   */
  rowPath: string;
  includeAttributes?: boolean;
  attributePrefix?: string;
}

export type DataFormatConfig = CsvDataFormatConfig | XmlDataFormatConfig;

// Credentials Config
export type HttpAuthType = "NONE" | "BASIC" | "BEARER" | "API_KEY";
export type SftpAuthType = "PASSWORD" | "PRIVATE_KEY";
export type ConnectionAuthType = HttpAuthType | SftpAuthType;

export interface HttpNoneCredentials {
  authType: "NONE";
}

export interface HttpBasicCredentials {
  authType: "BASIC";
  /**
   * @minLength 1
   */
  username: string;
  /**
   * @minLength 1
   */
  password: string;
}

export interface HttpBearerCredentials {
  authType: "BEARER";
  /**
   * @minLength 1
   */
  token: string;
}

export interface HttpApiKeyCredentials {
  authType: "API_KEY";
  /**
   * @minLength 1
   */
  headerName: string;
  /**
   * @minLength 1
   */
  headerValue: string;
}

export type HttpCredentials =
  | HttpNoneCredentials
  | HttpBasicCredentials
  | HttpBearerCredentials
  | HttpApiKeyCredentials;

export interface SftpPasswordCredentials {
  authType: "PASSWORD";
  /**
   * @minLength 1
   */
  username: string;
  /**
   * @minLength 1
   */
  password: string;
}

export interface SftpPrivateKeyCredentials {
  authType: "PRIVATE_KEY";
  /**
   * @minLength 1
   */
  username: string;
  /**
   * @minLength 1
   */
  privateKey: string;
  passphrase?: string;
}

export type SftpCredentials =
  | SftpPasswordCredentials
  | SftpPrivateKeyCredentials;

export type ConnectionCredentials = HttpCredentials | SftpCredentials;

export type ConnectionTestProgress = "start" | "download" | "convert" | "finish" | null;

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

export interface DataConnectionDto {
  id: string;
  userId?: string;
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

export interface CreateDataConnectionDto {
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  config: ConnectionConfig;
  dataFormatConfig: DataFormatConfig;
  isActive?: boolean;
  credentials?: ConnectionCredentials | Record<string, unknown> | null;
  testResult?: ConnectionTestResult | null;
}

export interface UpdateDataConnectionDto {
  name?: string;
  channel?: DataConnectionChannel;
  dataFormat?: DataConnectionFormat;
  config?: ConnectionConfig;
  dataFormatConfig?: DataFormatConfig;
  isActive?: boolean;
  credentials?: ConnectionCredentials | Record<string, unknown> | null;
  testResult?: ConnectionTestResult | null;
}

export interface IDataConnectionRepository {
  getAllByUserId(userId: string): Promise<DataConnection[]>;
  getByIdAndUserId(id: string, userId: string): Promise<DataConnection | null>;
  getById(id: string): Promise<DataConnection | null>;
  create(userId: string, data: CreateDataConnectionDto): Promise<DataConnection>;
  update(id: string, userId: string, data: UpdateDataConnectionDto): Promise<DataConnection | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
