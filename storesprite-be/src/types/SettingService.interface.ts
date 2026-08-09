import { Language } from "../entities/Language.js";
import { UserSetting } from "../entities/UserSetting.js";

export interface UserSettingsDto {
  unasApiKey?: string | null;
  unasApiEndpoint?: string | null;
  languageId?: number | null;
}

export interface SaveUserSettingsDto {
  unasApiKey?: string | null;
  unasApiEndpoint?: string | null;
  languageId?: number | null;
}

export interface ISettingService {
  getUserSettings(userId: string): Promise<UserSettingsDto | null>;
  saveUserSettings(userId: string, data: SaveUserSettingsDto): Promise<UserSetting>;
  getAvailableLanguages(): Promise<Language[]>;
}
