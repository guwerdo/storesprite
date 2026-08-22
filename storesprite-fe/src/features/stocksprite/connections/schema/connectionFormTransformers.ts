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
    httpBasicUsername:
      isHttp && typeof creds?.username === 'string' ? creds.username : '',
    httpBasicPassword:
      isHttp && typeof creds?.password === 'string' ? creds.password : '',
    httpBearerToken:
      isHttp && typeof creds?.token === 'string' ? creds.token : '',
    httpApiKeyHeaderName:
      isHttp && typeof creds?.headerName === 'string' ? creds.headerName : 'X-Api-Key',
    httpApiKeyHeaderValue:
      isHttp && typeof creds?.headerValue === 'string' ? creds.headerValue : '',

    // SFTP Credentials
    sftpAuthType:
      isSftp && typeof creds?.authType === 'string'
        ? (creds.authType as SftpAuthType)
        : 'PASSWORD',
    sftpPasswordUsername:
      isSftp && creds?.authType === 'PASSWORD' && typeof creds?.username === 'string'
        ? creds.username
        : '',
    sftpPasswordPassword:
      isSftp && creds?.authType === 'PASSWORD' && typeof creds?.password === 'string'
        ? creds.password
        : '',
    sftpKeyUsername:
      isSftp && creds?.authType === 'PRIVATE_KEY' && typeof creds?.username === 'string'
        ? creds.username
        : '',
    sftpPrivateKey:
      isSftp && creds?.authType === 'PRIVATE_KEY' && typeof creds?.privateKey === 'string'
        ? creds.privateKey
        : '',
    sftpKeyPassphrase:
      isSftp && creds?.authType === 'PRIVATE_KEY' && typeof creds?.passphrase === 'string'
        ? creds.passphrase
        : '',
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

  let credentialsPayload: ConnectionCredentials;
  if (values.channel === 'HTTP') {
    if (values.httpAuthType === 'NONE') {
      credentialsPayload = { authType: 'NONE' };
    } else if (values.httpAuthType === 'BASIC') {
      credentialsPayload = {
        authType: 'BASIC',
        username: values.httpBasicUsername.trim(),
        password: values.httpBasicPassword,
      };
    } else if (values.httpAuthType === 'BEARER') {
      credentialsPayload = {
        authType: 'BEARER',
        token: values.httpBearerToken.trim(),
      };
    } else {
      credentialsPayload = {
        authType: 'API_KEY',
        headerName: values.httpApiKeyHeaderName.trim(),
        headerValue: values.httpApiKeyHeaderValue.trim(),
      };
    }
  } else {
    if (values.sftpAuthType === 'PASSWORD') {
      credentialsPayload = {
        authType: 'PASSWORD',
        username: values.sftpPasswordUsername.trim(),
        password: values.sftpPasswordPassword,
      };
    } else {
      credentialsPayload = {
        authType: 'PRIVATE_KEY',
        username: values.sftpKeyUsername.trim(),
        privateKey: values.sftpPrivateKey.trim(),
        ...(values.sftpKeyPassphrase ? { passphrase: values.sftpKeyPassphrase } : {}),
      };
    }
  }

  return {
    name: values.name.trim(),
    channel: values.channel,
    dataFormat: values.dataFormat,
    isActive: values.isActive,
    config: configPayload,
    dataFormatConfig: dataFormatPayload,
    credentials: credentialsPayload,
  };
}
