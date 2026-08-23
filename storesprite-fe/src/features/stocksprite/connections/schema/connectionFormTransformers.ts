import type {
  IDataConnection,
  ICreateConnectionPayload,
  HttpConnectionConfig,
  SftpConnectionConfig,
  CsvDataFormatConfig,
  XmlDataFormatConfig,
  HttpAuthType,
  SftpAuthType,
  ConnectionCredentials,
} from '../../../../types/DataConnection.interface.js';
import {
  type ConnectionFormValues,
  defaultConnectionFormValues,
} from './connectionFormSchema.js';

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

function buildCredentials(values: ConnectionFormValues): ConnectionCredentials {
  if (values.channel === 'HTTP') {
    switch (values.httpAuthType) {
      case 'NONE':
        return { authType: 'NONE' };
      case 'BASIC':
        return { authType: 'BASIC', username: values.httpBasicUsername.trim(), password: values.httpBasicPassword };
      case 'BEARER':
        return { authType: 'BEARER', token: values.httpBearerToken.trim() };
      case 'API_KEY':
        return { authType: 'API_KEY', headerName: values.httpApiKeyHeaderName.trim(), headerValue: values.httpApiKeyHeaderValue.trim() };
    }
  }

  if (values.sftpAuthType === 'PASSWORD') {
    return { authType: 'PASSWORD', username: values.sftpPasswordUsername.trim(), password: values.sftpPasswordPassword };
  }

  return {
    authType: 'PRIVATE_KEY',
    username: values.sftpKeyUsername.trim(),
    privateKey: values.sftpPrivateKey.trim(),
    ...(values.sftpKeyPassphrase ? { passphrase: values.sftpKeyPassphrase } : {}),
  };
}

export function toFormValues(connection?: IDataConnection | null): ConnectionFormValues {
  if (!connection) {
    return { ...defaultConnectionFormValues };
  }

  const isHttp = connection.channel === 'HTTP';
  const isSftp = connection.channel === 'SFTP';
  const httpCfg = (isHttp ? connection.config : {}) as Partial<HttpConnectionConfig>;
  const sftpCfg = (isSftp ? connection.config : {}) as Partial<SftpConnectionConfig>;

  const isCsv = connection.dataFormat === 'CSV';
  const isXml = connection.dataFormat === 'XML';
  const csvCfg = (isCsv ? connection.dataFormatConfig : {}) as Partial<CsvDataFormatConfig>;
  const xmlCfg = (isXml ? connection.dataFormatConfig : {}) as Partial<XmlDataFormatConfig>;

  const creds = connection.credentials as Record<string, unknown> | undefined;

  return {
    name: connection.name || '',
    channel: connection.channel || 'HTTP',
    dataFormat: connection.dataFormat || 'CSV',
    isActive: connection.isActive !== undefined ? connection.isActive : false,

    // HTTP Transport
    httpUrl: httpCfg.url || '',
    httpMethod: httpCfg.method || 'GET',
    httpInsecureIgnoreSsl: Boolean(httpCfg.insecureIgnoreSsl),
    httpTimeoutSeconds: httpCfg.timeoutSeconds ? String(httpCfg.timeoutSeconds) : '30',

    // SFTP Transport
    sftpHost: sftpCfg.host || '',
    sftpPort: sftpCfg.port ? String(sftpCfg.port) : '22',
    sftpRemoteDir: sftpCfg.remoteDir || '/',
    sftpFileSelectionStrategy: sftpCfg.fileSelectionStrategy || 'LATEST_ALPHABETICAL',

    // CSV Parser
    csvDelimiter: csvCfg.delimiter || ';',
    csvEncoding: csvCfg.encoding || 'UTF-8',
    csvHasHeaders: csvCfg.hasHeaders !== undefined ? Boolean(csvCfg.hasHeaders) : true,

    // XML Parser
    xmlRowPath: xmlCfg.rowPath || './/product',
    xmlIncludeAttributes: Boolean(xmlCfg.includeAttributes),
    xmlAttributePrefix: xmlCfg.attributePrefix || '',

    // HTTP Credentials
    httpAuthType:
      isHttp && typeof creds?.authType === 'string'
        ? (creds.authType as HttpAuthType)
        : 'NONE',
    httpBasicUsername: isHttp ? asString(creds?.username) : '',
    httpBasicPassword: isHttp ? asString(creds?.password) : '',
    httpBearerToken: isHttp ? asString(creds?.token) : '',
    httpApiKeyHeaderName: isHttp ? asString(creds?.headerName, 'X-Api-Key') : 'X-Api-Key',
    httpApiKeyHeaderValue: isHttp ? asString(creds?.headerValue) : '',

    // SFTP Credentials
    sftpAuthType:
      isSftp && typeof creds?.authType === 'string'
        ? (creds.authType as SftpAuthType)
        : 'PASSWORD',
    sftpPasswordUsername:
      isSftp && creds?.authType === 'PASSWORD' ? asString(creds?.username) : '',
    sftpPasswordPassword:
      isSftp && creds?.authType === 'PASSWORD' ? asString(creds?.password) : '',
    sftpKeyUsername:
      isSftp && creds?.authType === 'PRIVATE_KEY' ? asString(creds?.username) : '',
    sftpPrivateKey:
      isSftp && creds?.authType === 'PRIVATE_KEY' ? asString(creds?.privateKey) : '',
    sftpKeyPassphrase:
      isSftp && creds?.authType === 'PRIVATE_KEY' ? asString(creds?.passphrase) : '',
  };
}

export function toApiPayload(values: ConnectionFormValues): ICreateConnectionPayload {
  const configPayload =
    values.channel === 'HTTP'
      ? ({
          channel: 'HTTP',
          url: values.httpUrl.trim(),
          method: values.httpMethod,
          insecureIgnoreSsl: values.httpInsecureIgnoreSsl,
          timeoutSeconds: values.httpTimeoutSeconds ? parseInt(values.httpTimeoutSeconds, 10) : undefined,
        } as HttpConnectionConfig)
      : ({
          channel: 'SFTP',
          host: values.sftpHost.trim(),
          port: values.sftpPort ? parseInt(values.sftpPort, 10) : 22,
          remoteDir: values.sftpRemoteDir.trim(),
          fileSelectionStrategy: values.sftpFileSelectionStrategy,
        } as SftpConnectionConfig);

  const dataFormatPayload =
    values.dataFormat === 'CSV'
      ? ({
          format: 'CSV',
          delimiter: values.csvDelimiter,
          encoding: values.csvEncoding || 'UTF-8',
          hasHeaders: values.csvHasHeaders,
        } as CsvDataFormatConfig)
      : ({
          format: 'XML',
          rowPath: values.xmlRowPath.trim(),
          includeAttributes: values.xmlIncludeAttributes,
          attributePrefix: values.xmlAttributePrefix || '',
        } as XmlDataFormatConfig);

  return {
    name: values.name.trim(),
    channel: values.channel,
    dataFormat: values.dataFormat,
    isActive: values.isActive,
    config: configPayload,
    dataFormatConfig: dataFormatPayload,
    credentials: buildCredentials(values),
  };
}
