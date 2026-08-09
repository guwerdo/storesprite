import { Language } from "../entities/Language.js";
import { UserSetting } from "../entities/UserSetting.js";

export interface ISettingRepository {
  getByUserId(userId: string): Promise<UserSetting | null>;
  upsert(
    userId: string,
    data: { unasApiKey?: string | null; unasApiEndpoint?: string | null; languageId?: number | null }
  ): Promise<UserSetting>;
  getLanguages(): Promise<Language[]>;
}
