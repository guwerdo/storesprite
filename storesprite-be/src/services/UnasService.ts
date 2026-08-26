import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import type { IUnasJsonClientConfig, ILoginResponse } from "@storesprite/unas-json-client";
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

  public async login(config: IUnasJsonClientConfig): Promise<ILoginResponse> {
    this._logger?.info("Creating UNAS JSON client", { baseUrl: config.baseUrl });

    const client = this._unasClientFactory.create(config);

    this._logger?.info("Calling UNAS login", { baseUrl: config.baseUrl });
    const response = await client.login(true);

    this._logger?.info("UNAS login succeeded", {
      shopId: response.shopId,
      webshopName: response.webshopInfo?.webshopName,
    });

    return response;
  }
}
