import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import type { IUnasJsonClientConfig, IWebshopInfo } from "@storesprite/unas-json-client";
import { TYPES } from "../di/index.js";
import type { IUnasClientFactory } from "../types/UnasClientFactory.interface.js";
import type { IUnasService } from "../types/UnasService.interface.js";

@injectable()
export class UnasService implements IUnasService {
  constructor(
    @inject(TYPES.IUnasClientFactory)
    private readonly _unasClientFactory: IUnasClientFactory,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async getWebshopInfo(config: IUnasJsonClientConfig): Promise<IWebshopInfo> {
    this._logger?.info("Creating UNAS JSON client", { baseUrl: config.baseUrl });

    const client = this._unasClientFactory.create(config);

    this._logger?.info("Calling UNAS login for webshop info", { baseUrl: config.baseUrl });
    const response = await client.login(true);

    if (!response.webshopInfo) {
      throw new Error("UNAS login response did not include webshop info");
    }

    this._logger?.info("UNAS webshop info retrieved", {
      shopId: response.shopId,
      webshopName: response.webshopInfo.webshopName,
    });

    return response.webshopInfo;
  }
}
