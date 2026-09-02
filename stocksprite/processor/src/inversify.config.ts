import { Container } from "inversify";
import type { Logger } from "log4js";
import { createUnasJsonClient } from "@storesprite/unas-json-client";
import { TYPES } from "./types/binding-keys.js";
import type { AppConfig } from "./config/app.config.js";
import { getAppConfig } from "./config/app.config.js";
import { configureLogger, getLogger } from "./config/log4js.config.js";
import type { UnasClientFactory } from "./types/mapping.interface.js";
import type { IBackendApiClient } from "./services/backend-api-client.js";
import { BackendApiClient } from "./services/backend-api-client.js";
import { ConnectionIndexRepository } from "./repository/connection-index.repository.js";
import { RuleTransformService } from "./services/rule-transform.service.js";
import { ConnectionFeedService } from "./services/connection-feed.service.js";
import { UnasProductDbService } from "./services/unas-product-db.service.js";
import { UnasUpdateService } from "./services/unas-update.service.js";
import { ProcessorService } from "./services/processor.service.js";

/**
 * Manual composition root (no redis/bullmq, no jsonlogic). Config and logger can
 * be overridden for tests; the real run reads them from the environment.
 */
export function createContainer(customConfig?: AppConfig, customLogger?: Logger): Container {
    const container = new Container({ defaultScope: "Singleton" });

    const config = customConfig ?? getAppConfig();
    container.bind<AppConfig>(TYPES.AppConfig).toConstantValue(config);

    let logger = customLogger;
    if (logger === undefined) {
        configureLogger();
        logger = getLogger("default");
    }
    container.bind<Logger>(TYPES.Logger).toConstantValue(logger);

    container.bind<IBackendApiClient>(TYPES.IBackendApiClient).to(BackendApiClient);
    container.bind<UnasClientFactory>(TYPES.UnasClientFactory).toConstantValue(createUnasJsonClient);

    container.bind(ConnectionIndexRepository).toSelf();
    container.bind(RuleTransformService).toSelf();
    container.bind(ConnectionFeedService).toSelf();
    container.bind(UnasProductDbService).toSelf();
    container.bind(UnasUpdateService).toSelf();
    container.bind(ProcessorService).toSelf();

    return container;
}
