import type { IUnasConnection } from '../unas/UnasConnection.interface.js';

export interface ILanguage {
  id: number;
  code: string;
}

export interface IUserSettings {
  unasApiKey: string;
  unasApiEndpoint?: string | null;
  languageId: number | null;
  unasConnection?: IUnasConnection | null;
  timezone?: string | null;
}

export interface ISettingsApiResponse {
  settings: IUserSettings | null;
  languages: ILanguage[];
}

export interface ISaveSettingsRequest {
  unasApiKey: string;
  unasApiEndpoint?: string | null;
  languageId: number | null;
  timezone?: string | null;
}

export interface ISaveSettingsResponse {
  success: boolean;
  settings?: IUserSettings;
}
