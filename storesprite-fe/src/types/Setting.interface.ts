export interface ILanguage {
  id: number;
  code: string;
}

export interface IUserSettings {
  unasApiKey: string;
  unasApiEndpoint?: string | null;
  languageId: number | null;
}

export interface ISettingsApiResponse {
  settings: IUserSettings | null;
  languages: ILanguage[];
}

export interface ISaveSettingsRequest {
  unasApiKey: string;
  unasApiEndpoint?: string | null;
  languageId: number | null;
}

export interface ISaveSettingsResponse {
  success: boolean;
  settings?: IUserSettings;
}
