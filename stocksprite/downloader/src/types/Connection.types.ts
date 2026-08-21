export type DataConnectionChannel = "HTTP" | "SFTP";
export type DataConnectionFormat = "CSV" | "XML";

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

// Credentials Config
export type HttpAuthType = "NONE" | "BASIC" | "BEARER" | "API_KEY";
export type SftpAuthType = "PASSWORD" | "PRIVATE_KEY";

export interface HttpNoneCredentials {
  authType: "NONE";
}

export interface HttpBasicCredentials {
  authType: "BASIC";
  username: string;
  password: string;
}

export interface HttpBearerCredentials {
  authType: "BEARER";
  token: string;
}

export interface HttpApiKeyCredentials {
  authType: "API_KEY";
  headerName: string;
  headerValue: string;
}

export type HttpCredentials =
  | HttpNoneCredentials
  | HttpBasicCredentials
  | HttpBearerCredentials
  | HttpApiKeyCredentials;

export interface SftpPasswordCredentials {
  authType: "PASSWORD";
  username: string;
  password: string;
}

export interface SftpPrivateKeyCredentials {
  authType: "PRIVATE_KEY";
  username: string;
  privateKey: string;
  passphrase?: string;
}

export type SftpCredentials =
  | SftpPasswordCredentials
  | SftpPrivateKeyCredentials;

export type ConnectionCredentials = HttpCredentials | SftpCredentials;

export interface DataConnectionDto {
  id: string;
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  config: ConnectionConfig;
  dataFormatConfig: DataFormatConfig;
  isActive: boolean;
  credentials?: ConnectionCredentials | Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
