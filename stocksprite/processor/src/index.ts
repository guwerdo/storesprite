import "reflect-metadata";
import type { Logger } from "log4js";
import { TYPES } from "./types/binding-keys.js";
import type { AppConfig } from "./config/app.config.js";
import { createContainer } from "./inversify.config.js";
import { ProcessorService } from "./services/processor.service.js";
import { stringifyError } from "./utils/error-util.js";

async function main(): Promise<void> {
    let logger: Logger | undefined;
    let mappingId: string | undefined;
    let runId: string | undefined;
    try {
        const container = createContainer();
        const config = container.get<AppConfig>(TYPES.AppConfig);
        mappingId = config.mappingId;
        runId = config.runId;
        logger = container.get<Logger>(TYPES.Logger);
        logger.info("Stock processor starting", { mappingId, runId });

        const processor = container.get<ProcessorService>(ProcessorService);
        const exitCode = await processor.run();

        logger.info("Stock processor exiting", { mappingId, runId, exitCode });
        process.exitCode = exitCode;
    } catch (error) {
        const message = stringifyError(error);
        if (logger !== undefined) {
            logger.error("Fatal error during processor startup", { mappingId, runId, error: message });
        } else {
            console.error(`[stocksprite-processor] Fatal: ${message}`);
        }
        process.exitCode = 1;
    }
}

void main();
