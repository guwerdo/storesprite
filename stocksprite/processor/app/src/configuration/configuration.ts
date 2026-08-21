/**
 * Default configuration builder for the application.
 * This file creates the application's configuration instance using the layered approach:
 * 1. configuration/configuration.json (base configuration)
 * 2. configuration/configuration.{NODE_ENV}.json (environment-specific overrides)
 * 3. Environment variables with 'CONFIG_' prefix
 *
 * To use configuration in your code, inject IConfiguration via the DI container:
 *
 * @example
 * ```typescript
 * @injectable()
 * class MyService {
 *     constructor(@inject(BindingKeys.IConfiguration) private config: IConfiguration) {}
 *
 *     doSomething() {
 *         const redisConfig = this.config.getSection<IRedisConfigSection>("redis");
 *         console.log(redisConfig.connection.host);
 *     }
 * }
 * ```
 */
import { ConfigurationBuilder } from "@storesprite/app-config";

/**
 * Default application configuration instance.
 * This is registered in the DI container and can be overridden for testing.
 */
export const configuration = ConfigurationBuilder.createDefault().build();
