import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { Language } from "../entities/Language.js";
import { UserSetting } from "../entities/UserSetting.js";
import { ISettingService, ISettingRepository, UserSettingsDto, SaveUserSettingsDto, TYPES } from "../di/index.js";
import type { UnasConnectionRecord } from "../types/UnasConnection.interface.js";
import { DEFAULT_UNAS_API_ENDPOINT } from "../config/unas.constants.js";

@injectable()
export class SettingService implements ISettingService {
  constructor(
    @inject(TYPES.ISettingRepository)
    private readonly _settingRepository: ISettingRepository,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  async getUserSettings(userId: string): Promise<UserSettingsDto | null> {
    this._logger?.info("Fetching user settings in service", { userId });
    const setting = await this._settingRepository.getByUserId(userId);
    if (!setting) {
      return null;
    }

    return {
      unasApiKey: setting.unasApiKey ?? null,
      unasApiEndpoint: setting.unasApiEndpoint ?? DEFAULT_UNAS_API_ENDPOINT,
      languageId: setting.language?.id ?? null,
      unasConnection: setting.unasConnection ?? null,
    };
  }

  async saveUserSettings(userId: string, data: SaveUserSettingsDto): Promise<UserSetting> {
    this._logger?.info("Saving user settings in service", { userId, languageId: data.languageId });
    return this._settingRepository.upsert(userId, data);
  }

  async getAvailableLanguages(): Promise<Language[]> {
    this._logger?.info("Fetching available languages in service");
    return this._settingRepository.getLanguages();
  }

  async saveUnasConnection(userId: string, connection: UnasConnectionRecord | null): Promise<void> {
    this._logger?.info("Saving UNAS connection in service", { userId, hasConnection: connection !== null });
    await this._settingRepository.setUnasConnection(userId, connection);
  }
}
