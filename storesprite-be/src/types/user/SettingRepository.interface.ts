import { Language } from "../../entities/user/Language.js";
import { UserSetting } from "../../entities/user/UserSetting.js";
import type { UnasConnectionRecord } from "../unas/UnasConnection.interface.js";

export interface ISettingRepository {
  getByUserId(userId: string): Promise<UserSetting | null>;
  upsert(
    userId: string,
    data: { unasApiKey?: string | null; unasApiEndpoint?: string | null; languageId?: number | null; timezone?: string | null }
  ): Promise<UserSetting>;
  getLanguages(): Promise<Language[]>;
  setUnasConnection(userId: string, connection: UnasConnectionRecord | null): Promise<void>;
}
