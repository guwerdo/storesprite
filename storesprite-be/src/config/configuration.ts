import { ConfigurationBuilder, type IConfiguration } from "@storesprite/app-config";

/**
 * Default application configuration instance for storesprite-be.
 */
export const configuration: IConfiguration = ConfigurationBuilder.createDefault().build();
