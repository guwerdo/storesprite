import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { UnasConfigError, UnasHttpError, type ILoginResponse, type IWarehouseResponse } from "@storesprite/unas-json-client";
import { TYPES, ISettingService } from "../di/index.js";
import { Util } from "../utils/index.js";
import type { IUnasClientFactory } from "../types/UnasClientFactory.interface.js";
import type { IUnasService } from "../types/UnasService.interface.js";
import type { UnasConnectionRecord } from "../types/UnasConnection.interface.js";
import { DEFAULT_UNAS_API_ENDPOINT } from "../config/unas.constants.js";

@injectable()
export class UnasService implements IUnasService {
  constructor(
    @inject(TYPES.ISettingService)
    private readonly _settingService: ISettingService,
    @inject(TYPES.IUnasClientFactory)
    private readonly _unasClientFactory: IUnasClientFactory,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async login(userId: string): Promise<UnasConnectionRecord> {
    const config = await this._buildConfig(userId);

    this._logger?.info("Creating UNAS JSON client", { baseUrl: config.baseUrl });
    const client = this._unasClientFactory.create(config);

    this._logger?.info("Calling UNAS login", { baseUrl: config.baseUrl });

    let response: ILoginResponse;
    try {
      response = await client.login(true);
    } catch (err: unknown) {
      if (err instanceof UnasHttpError) {
        try {
          await this._settingService.saveUnasConnection(userId, null);
        } catch (resetErr: unknown) {
          this._logger?.error("Failed to reset UNAS connection", { userId, error: Util.stringifyError(resetErr) });
        }
      }
      throw err;
    }

    this._logger?.info("UNAS login succeeded", {
      shopId: response.shopId,
      webshopName: response.webshopInfo?.webshopName,
    });

    const record: UnasConnectionRecord = {
      ...response,
      token: null,
      checkedAt: new Date().toISOString(),
    };
    await this._settingService.saveUnasConnection(userId, record);

    return record;
  }

  public async getWarehouses(userId: string): Promise<IWarehouseResponse[]> {
    const config = await this._buildConfig(userId);

    this._logger?.info("Fetching UNAS warehouses", { baseUrl: config.baseUrl });
    const client = this._unasClientFactory.create(config);
    return client.getWarehouse();
  }

  private async _buildConfig(userId: string): Promise<{ baseUrl: string; apiKey: string; tokenKey: string }> {
    const settings = await this._settingService.getUserSettings(userId);
    if (!settings?.unasApiKey) {
      this._logger?.warn("UNAS API call attempted without configured API key", { userId });
      throw new UnasConfigError("UNAS API key is not configured");
    }

    return {
      baseUrl: settings.unasApiEndpoint ?? DEFAULT_UNAS_API_ENDPOINT,
      apiKey: settings.unasApiKey,
      tokenKey: userId,
    };
  }
}
