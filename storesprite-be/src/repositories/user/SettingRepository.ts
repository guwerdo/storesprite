import { injectable, inject } from "inversify";
import { EntityManager } from "@mikro-orm/postgresql";
import type { Logger } from "log4js";
import { User } from "../../entities/user/User.js";
import { Language } from "../../entities/user/Language.js";
import { UserSetting } from "../../entities/user/UserSetting.js";
import type { UnasConnectionRecord } from "../../types/unas/UnasConnection.interface.js";
import { DEFAULT_UNAS_API_ENDPOINT } from "../../config/unas/unas.constants.js";
import { ISettingRepository, TYPES } from "../../di/index.js";

@injectable()
export class SettingRepository implements ISettingRepository {
  constructor(
    @inject(TYPES.EntityManager)
    private readonly _em: EntityManager,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  async getByUserId(userId: string): Promise<UserSetting | null> {
    this._logger?.info("Fetching user settings by user ID", { userId });
    return this._em.findOne(
      UserSetting,
      { user: { id: userId } },
      { populate: ["language"] }
    );
  }

  async upsert(
    userId: string,
    data: { unasApiKey?: string | null; unasApiEndpoint?: string | null; languageId?: number | null; timezone?: string | null }
  ): Promise<UserSetting> {
    this._logger?.info("Upserting user settings", { userId, languageId: data.languageId });

    const existing = await this.getByUserId(userId);
    let language: Language | null = null;

    if (data.languageId) {
      language = await this._em.findOne(Language, { id: data.languageId });
    }

    if (existing) {
      if (data.unasApiKey !== undefined) {
        existing.unasApiKey = data.unasApiKey;
      }
      if (data.unasApiEndpoint !== undefined) {
        existing.unasApiEndpoint = data.unasApiEndpoint;
      }
      if (data.languageId !== undefined) {
        existing.language = language;
      }
      if (data.timezone !== undefined) {
        existing.timezone = data.timezone;
      }
      existing.updatedAt = new Date();
      await this._em.flush();
      this._logger?.info("User settings updated successfully", { userId, settingId: existing.id });
      return existing;
    }

    const user = await this._em.findOne(User, { id: userId });
    if (!user) {
      this._logger?.error("Cannot create settings: user not found", { userId });
      throw new Error(`User not found for ID: ${userId}`);
    }

    const newSetting = new UserSetting(
      user,
      data.unasApiKey,
      language,
      data.unasApiEndpoint ?? DEFAULT_UNAS_API_ENDPOINT,
      undefined,
      data.timezone
    );
    await this._em.persistAndFlush(newSetting);
    this._logger?.info("New user settings created successfully", { userId, settingId: newSetting.id });
    return newSetting;
  }

  async getLanguages(): Promise<Language[]> {
    this._logger?.info("Fetching all available languages");
    return this._em.find(Language, {}, { orderBy: { id: "ASC" } });
  }

  async setUnasConnection(userId: string, connection: UnasConnectionRecord | null): Promise<void> {
    this._logger?.info("Setting UNAS connection", { userId, hasConnection: connection !== null });

    const setting = await this._em.findOne(UserSetting, { user: { id: userId } });
    if (!setting) {
      this._logger?.warn("Cannot set UNAS connection: no settings row for user", { userId });
      return;
    }

    setting.unasConnection = connection;
    setting.updatedAt = new Date();
    await this._em.flush();

    this._logger?.info("UNAS connection saved", { userId, hasConnection: connection !== null });
  }
}
