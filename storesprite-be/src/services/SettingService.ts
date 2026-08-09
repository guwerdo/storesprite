import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { Language } from "../entities/Language.js";
import { UserSetting } from "../entities/UserSetting.js";
import { ISettingService, ISettingRepository, UserSettingsDto, SaveUserSettingsDto, TYPES } from "../di/index.js";

@injectable()
export class SettingService implements ISettingService {
  constructor(
    @inject(TYPES.ISettingRepository)
    private readonly _settingRepository?: ISettingRepository,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  async getUserSettings(userId: string): Promise<UserSettingsDto | null> {
    this._logger?.info("Fetching user settings in service", { userId });
    if (!this._settingRepository) {
      this._logger?.warn("Setting repository unavailable when fetching settings", { userId });
      return null;
    }

    const setting = await this._settingRepository.getByUserId(userId);
    if (!setting) {
      return null;
    }

    return {
      unasApiKey: setting.unasApiKey ?? null,
      unasApiEndpoint: setting.unasApiEndpoint ?? "https://api.unas.eu/shop/",
      languageId: setting.language?.id ?? null,
    };
  }

  async saveUserSettings(userId: string, data: SaveUserSettingsDto): Promise<UserSetting> {
    this._logger?.info("Saving user settings in service", { userId, languageId: data.languageId });
    if (!this._settingRepository) {
      this._logger?.warn("Setting repository unavailable when saving settings", { userId });
      throw new Error("Setting repository unavailable");
    }

    return this._settingRepository.upsert(userId, data);
  }

  async getAvailableLanguages(): Promise<Language[]> {
    this._logger?.info("Fetching available languages in service");
    if (!this._settingRepository) {
      this._logger?.warn("Setting repository unavailable when fetching languages");
      return [];
    }

    return this._settingRepository.getLanguages();
  }
}
