import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import {
  createUnasJsonClient,
  type IUnasJsonClient,
  type IUnasJsonClientConfig,
  type ILogger,
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
    const unasLogger: ILogger | undefined = this._logger
      ? {
          info: (message: string, meta?: unknown) => this._logger!.info(message, meta),
          warn: (message: string, meta?: unknown) => this._logger!.warn(message, meta),
          error: (message: string, meta?: unknown) => this._logger!.error(message, meta),
          debug: (message: string, meta?: unknown) => this._logger!.debug(message, meta),
        }
      : undefined;

    return createUnasJsonClient(config, { logger: unasLogger });
  }
}
