import { IBullMqConfiguration } from "./bullmq-configuration.interface.js";
import { ILog4jsConfiguration } from "./log4js-configuration.interface.js";
import { IRedisConfiguration } from "./redis-configuration.interface.js";

/**
 * Root application configuration structure.
 * This represents the complete configuration schema.
 */
export interface IApplicationConfiguration {
    redis: IRedisConfiguration;
    log4js: ILog4jsConfiguration;
    bullMq: IBullMqConfiguration;
}
