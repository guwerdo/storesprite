import "reflect-metadata";
import type { Logger } from "log4js";
import { createContainer, TYPES } from "./di/index.js";
import type { AppConfig } from "./config/app.config.js";
import { IDownloaderService } from "./types/downloader-service.interface.js";
import { ErrorUtil } from "./utils/error-util.js";

async function main(): Promise<void> {
  let logger: Logger | undefined;
  let userId: string | undefined;

  try {
    const container = createContainer();
    const config = container.get<AppConfig>(TYPES.AppConfig);
    userId = config.userId;
    logger = container.get<Logger>(TYPES.Logger);

    logger.info("Initializing StoreSprite Downloader Service", { userId });

    const service = container.get<IDownloaderService>(TYPES.IDownloaderService);
    const summary = await service.run();

    if (summary.errorCount > 0) {
      logger.warn("Downloader finished with errors", {
        userId,
        successCount: summary.successCount,
        errorCount: summary.errorCount,
      });
      process.exit(1);
    } else {
      logger.info("Downloader completed successfully without errors", { userId });
      process.exit(0);
    }
  } catch (error) {
    const errorMsg = ErrorUtil.stringifyError(error);
    if (logger) {
      logger.error("Fatal exception during downloader execution", { userId, error: errorMsg });
    } else {
      console.error(`[FATAL] Downloader execution failed: ${errorMsg}`);
    }
    process.exit(1);
  }
}

void main();
