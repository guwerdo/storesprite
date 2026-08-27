import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import {
  createUnasJsonClient,
  type IUnasJsonClient,
  type IUnasJsonClientConfig,
  type ITokenStore,
} from "@storesprite/unas-json-client";
import { TYPES } from "../di/types.js";
import type { IUnasClientFactory } from "../types/UnasClientFactory.interface.js";

/**
 * Builds an UNAS JSON client per request, wiring in shared backend services:
 * the Log4js logger and the app-owned token store (keyed per tenant).
 */
@injectable()
export class UnasClientFactory implements IUnasClientFactory {
  constructor(
    @inject(TYPES.ITokenStore)
    private readonly _tokenStore: ITokenStore,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public create(config: IUnasJsonClientConfig): IUnasJsonClient {
    return createUnasJsonClient(config, { logger: this._logger, tokenStore: this._tokenStore });
  }
}
