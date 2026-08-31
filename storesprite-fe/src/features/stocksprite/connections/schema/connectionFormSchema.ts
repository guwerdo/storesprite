import { z } from 'zod';
import type {
  DataConnectionChannel,
  DataConnectionFormat,
  HttpAuthType,
  SftpAuthType,
} from '../../../../types/stocksprite/DataConnection.interface.js';

export interface ConnectionFormValues {
  name: string;
  channel: DataConnectionChannel;
  dataFormat: DataConnectionFormat;
  isActive: boolean;

  // HTTP Transport
  httpUrl: string;
  httpMethod: 'GET' | 'POST';
  httpInsecureIgnoreSsl: boolean;
  httpTimeoutSeconds: string;

  // SFTP Transport
  sftpHost: string;
  sftpPort: string;
  sftpRemoteDir: string;
  sftpFileSelectionStrategy: 'LATEST_ALPHABETICAL' | 'LATEST_MODIFIED' | 'EXACT_MATCH';

  // CSV Parser
  csvDelimiter: string;
  csvEncoding: string;
  csvHasHeaders: boolean;

  // XML Parser
  xmlRowPath: string;
  xmlIncludeAttributes: boolean;
  xmlAttributePrefix: string;

  // HTTP Credentials
  httpAuthType: HttpAuthType;
  httpBasicUsername: string;
  httpBasicPassword: string;
  httpBearerToken: string;
  httpApiKeyHeaderName: string;
  httpApiKeyHeaderValue: string;

  // SFTP Credentials
  sftpAuthType: SftpAuthType;
  sftpPasswordUsername: string;
  sftpPasswordPassword: string;
  sftpKeyUsername: string;
  sftpPrivateKey: string;
  sftpKeyPassphrase: string;
}

export const defaultConnectionFormValues: ConnectionFormValues = {
  name: '',
  channel: 'HTTP',
  dataFormat: 'CSV',
  isActive: false,

  httpUrl: '',
  httpMethod: 'GET',
  httpInsecureIgnoreSsl: false,
  httpTimeoutSeconds: '30',

  sftpHost: '',
  sftpPort: '22',
  sftpRemoteDir: '/',
  sftpFileSelectionStrategy: 'LATEST_ALPHABETICAL',

  csvDelimiter: ';',
  csvEncoding: 'UTF-8',
  csvHasHeaders: true,

  xmlRowPath: './/product',
  xmlIncludeAttributes: false,
  xmlAttributePrefix: '',

  httpAuthType: 'NONE',
  httpBasicUsername: '',
  httpBasicPassword: '',
  httpBearerToken: '',
  httpApiKeyHeaderName: 'X-Api-Key',
  httpApiKeyHeaderValue: '',

  sftpAuthType: 'PASSWORD',
  sftpPasswordUsername: '',
  sftpPasswordPassword: '',
  sftpKeyUsername: '',
  sftpPrivateKey: '',
  sftpKeyPassphrase: '',
};

export function createConnectionFormSchema(t: (key: string) => string) {
  return z
    .object({
      name: z
        .string()
        .min(1, { message: t('stocksprite.connections.form.nameRequired') })
        .max(255, { message: t('stocksprite.connections.form.nameMaxLength') }),
      channel: z.enum(['HTTP', 'SFTP']),
      dataFormat: z.enum(['CSV', 'XML']),
      isActive: z.boolean(),

      // HTTP Transport
      httpUrl: z.string(),
      httpMethod: z.enum(['GET', 'POST']),
      httpInsecureIgnoreSsl: z.boolean(),
      httpTimeoutSeconds: z.string(),

      // SFTP Transport
      sftpHost: z.string(),
      sftpPort: z.string(),
      sftpRemoteDir: z.string(),
      sftpFileSelectionStrategy: z.enum(['LATEST_ALPHABETICAL', 'LATEST_MODIFIED', 'EXACT_MATCH']),

      // CSV Parser
      csvDelimiter: z.string(),
      csvEncoding: z.string(),
      csvHasHeaders: z.boolean(),

      // XML Parser
      xmlRowPath: z.string(),
      xmlIncludeAttributes: z.boolean(),
      xmlAttributePrefix: z.string(),

      // HTTP Credentials
      httpAuthType: z.enum(['NONE', 'BASIC', 'BEARER', 'API_KEY']),
      httpBasicUsername: z.string(),
      httpBasicPassword: z.string(),
      httpBearerToken: z.string(),
      httpApiKeyHeaderName: z.string(),
      httpApiKeyHeaderValue: z.string(),

      // SFTP Credentials
      sftpAuthType: z.enum(['PASSWORD', 'PRIVATE_KEY']),
      sftpPasswordUsername: z.string(),
      sftpPasswordPassword: z.string(),
      sftpKeyUsername: z.string(),
      sftpPrivateKey: z.string(),
      sftpKeyPassphrase: z.string(),
    })
    .superRefine((data, ctx) => {
      const required = (path: string, value: string, message: string, trim = true): void => {
        const normalized = trim ? value.trim() : value;
        if (!normalized) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
        }
      };

      // Channel-specific validations
      if (data.channel === 'HTTP') {
        required('httpUrl', data.httpUrl, t('stocksprite.connections.form.http.urlRequired'));
        const url = data.httpUrl.trim();
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['httpUrl'],
            message: t('stocksprite.connections.form.http.urlInvalid'),
          });
        }

        // HTTP credentials
        if (data.httpAuthType === 'BASIC') {
          required('httpBasicUsername', data.httpBasicUsername, t('stocksprite.connections.form.credentials.http.usernameRequired'));
          required('httpBasicPassword', data.httpBasicPassword, t('stocksprite.connections.form.credentials.http.passwordRequired'), false);
        } else if (data.httpAuthType === 'BEARER') {
          required('httpBearerToken', data.httpBearerToken, t('stocksprite.connections.form.credentials.http.tokenRequired'));
        } else if (data.httpAuthType === 'API_KEY') {
          required('httpApiKeyHeaderName', data.httpApiKeyHeaderName, t('stocksprite.connections.form.credentials.http.headerNameRequired'));
          required('httpApiKeyHeaderValue', data.httpApiKeyHeaderValue, t('stocksprite.connections.form.credentials.http.headerValueRequired'));
        }
      } else if (data.channel === 'SFTP') {
        required('sftpHost', data.sftpHost, t('stocksprite.connections.form.sftp.hostRequired'));
        required('sftpRemoteDir', data.sftpRemoteDir, t('stocksprite.connections.form.sftp.remoteDirRequired'));

        // SFTP credentials
        if (data.sftpAuthType === 'PASSWORD') {
          required('sftpPasswordUsername', data.sftpPasswordUsername, t('stocksprite.connections.form.credentials.sftp.usernameRequired'));
          required('sftpPasswordPassword', data.sftpPasswordPassword, t('stocksprite.connections.form.credentials.sftp.passwordRequired'), false);
        } else if (data.sftpAuthType === 'PRIVATE_KEY') {
          required('sftpKeyUsername', data.sftpKeyUsername, t('stocksprite.connections.form.credentials.sftp.usernameRequired'));
          required('sftpPrivateKey', data.sftpPrivateKey, t('stocksprite.connections.form.credentials.sftp.privateKeyRequired'));
        }
      }

      // Parser-specific validations
      if (data.dataFormat === 'CSV') {
        required('csvDelimiter', data.csvDelimiter, t('stocksprite.connections.form.csv.delimiterRequired'), false);
      } else if (data.dataFormat === 'XML') {
        required('xmlRowPath', data.xmlRowPath, t('stocksprite.connections.form.xml.rowPathRequired'));
      }
    });
}
