import "reflect-metadata";
import type { Logger } from "log4js";
import { TYPES } from "./types/binding-keys.js";
import { createContainer } from "./inversify.config.js";
import { ProcessorService } from "./services/processor.service.js";
import { stringifyError } from "./utils/error-util.js";

async function main(): Promise<void> {
    let logger: Logger | undefined;
    try {
        const container = createContainer();
        logger = container.get<Logger>(TYPES.Logger);
        logger.info("Stock processor starting");

        const processor = container.get<ProcessorService>(ProcessorService);
        const exitCode = await processor.run();

        logger.info("Stock processor exiting", { exitCode });
        process.exitCode = exitCode;
    } catch (error) {
        const message = stringifyError(error);
        if (logger !== undefined) {
            logger.error("Fatal error during processor startup", { error: message });
        } else {
            console.error(`[stocksprite-processor] Fatal: ${message}`);
        }
        process.exitCode = 1;
    }
}

void main();
