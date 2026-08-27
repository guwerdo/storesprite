import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import {
  createUnasJsonClient,
  type IUnasJsonClient,
  type IUnasJsonClientConfig,
} from "@storesprite/unas-json-client";
import { TYPES } from "../di/types.js";
import type { IUnasClientFactory } from "../types/UnasClientFactory.interface.js";

/**
 * Builds an UNAS JSON client per request with shared backend services (e.g., Log4js Logger).
 */
@injectable()
export class UnasClientFactory implements IUnasClientFactory {
  constructor(
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public create(config: IUnasJsonClientConfig): IUnasJsonClient {
    return createUnasJsonClient(config, { logger: this._logger });
  }
}
