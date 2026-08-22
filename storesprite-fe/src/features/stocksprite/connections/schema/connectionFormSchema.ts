import { z } from 'zod';
import type { TFunction } from 'i18next';
import type {
  DataConnectionChannel,
  DataConnectionFormat,
  HttpAuthType,
  SftpAuthType,
} from '../../../../types/DataConnection.interface.js';

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

export function createConnectionFormSchema(t: TFunction) {
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
      // Channel specific validations
      if (data.channel === 'HTTP') {
        if (!data.httpUrl || data.httpUrl.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['httpUrl'],
            message: t('stocksprite.connections.form.http.urlRequired'),
          });
        } else if (!data.httpUrl.startsWith('http://') && !data.httpUrl.startsWith('https://')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['httpUrl'],
            message: t('stocksprite.connections.form.http.urlInvalid'),
          });
        }

        // HTTP Credentials
        if (data.httpAuthType === 'BASIC') {
          if (!data.httpBasicUsername || data.httpBasicUsername.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['httpBasicUsername'],
              message: t('stocksprite.connections.form.credentials.http.usernameRequired'),
            });
          }
          if (!data.httpBasicPassword || data.httpBasicPassword.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['httpBasicPassword'],
              message: t('stocksprite.connections.form.credentials.http.passwordRequired'),
            });
          }
        } else if (data.httpAuthType === 'BEARER') {
          if (!data.httpBearerToken || data.httpBearerToken.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['httpBearerToken'],
              message: t('stocksprite.connections.form.credentials.http.tokenRequired'),
            });
          }
        } else if (data.httpAuthType === 'API_KEY') {
          if (!data.httpApiKeyHeaderName || data.httpApiKeyHeaderName.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['httpApiKeyHeaderName'],
              message: t('stocksprite.connections.form.credentials.http.headerNameRequired'),
            });
          }
          if (!data.httpApiKeyHeaderValue || data.httpApiKeyHeaderValue.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['httpApiKeyHeaderValue'],
              message: t('stocksprite.connections.form.credentials.http.headerValueRequired'),
            });
          }
        }
      } else if (data.channel === 'SFTP') {
        if (!data.sftpHost || data.sftpHost.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sftpHost'],
            message: t('stocksprite.connections.form.sftp.hostRequired'),
          });
        }
        if (!data.sftpRemoteDir || data.sftpRemoteDir.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sftpRemoteDir'],
            message: t('stocksprite.connections.form.sftp.remoteDirRequired'),
          });
        }

        // SFTP Credentials
        if (data.sftpAuthType === 'PASSWORD') {
          if (!data.sftpPasswordUsername || data.sftpPasswordUsername.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['sftpPasswordUsername'],
              message: t('stocksprite.connections.form.credentials.sftp.usernameRequired'),
            });
          }
          if (!data.sftpPasswordPassword || data.sftpPasswordPassword.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['sftpPasswordPassword'],
              message: t('stocksprite.connections.form.credentials.sftp.passwordRequired'),
            });
          }
        } else if (data.sftpAuthType === 'PRIVATE_KEY') {
          if (!data.sftpKeyUsername || data.sftpKeyUsername.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['sftpKeyUsername'],
              message: t('stocksprite.connections.form.credentials.sftp.usernameRequired'),
            });
          }
          if (!data.sftpPrivateKey || data.sftpPrivateKey.trim().length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['sftpPrivateKey'],
              message: t('stocksprite.connections.form.credentials.sftp.privateKeyRequired'),
            });
          }
        }
      }

      // Parser specific validations
      if (data.dataFormat === 'CSV') {
        if (!data.csvDelimiter || data.csvDelimiter.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['csvDelimiter'],
            message: t('stocksprite.connections.form.csv.delimiterRequired'),
          });
        }
      } else if (data.dataFormat === 'XML') {
        if (!data.xmlRowPath || data.xmlRowPath.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['xmlRowPath'],
            message: t('stocksprite.connections.form.xml.rowPathRequired'),
          });
        }
      }
    });
}
