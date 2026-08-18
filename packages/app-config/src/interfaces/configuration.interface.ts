/**
 * Represents a unified configuration interface similar to .NET's IConfiguration.
 * Provides access to configuration values from multiple sources in a layered approach.
 */
export interface IConfiguration {
    /**
     * Gets a configuration value by key using colon notation or dot notation for nested values.
     * @example
     * config.get<string>("redis:connection:host") // "localhost"
     * config.get<number>("redis.connection.port") // 6379
     */
    get<T>(key: string): T | undefined;

    /**
     * Gets a configuration value with a default fallback.
     * @param key - The configuration key
     * @param defaultValue - The value to return if key is not found
     */
    getOrDefault<T>(key: string, defaultValue: T): T;

    /**
     * Gets a configuration section as a typed object.
     * @example
     * const redisConfig = config.getSection<IRedisConfig>("redis");
     */
    getSection<T>(section: string): T | undefined;

    /**
     * Checks if a configuration key exists.
     */
    has(key: string): boolean;

    /**
     * Gets all configuration as a flat key-value object.
     * Useful for debugging or logging.
     */
    getAll(): Record<string, unknown>;
}

/**
 * Configuration source for the builder.
 */
export interface IConfigurationSource {
    /**
     * Loads configuration data from the source.
     * Returns a nested object representing the configuration.
     */
    load(): Record<string, unknown> | Promise<Record<string, unknown>>;

    /**
     * Optional priority (higher = loaded last = wins in conflicts).
     */
    priority?: number;
}

/**
 * Options for building configuration.
 */
export interface IConfigurationBuilderOptions {
    /**
     * Base path for resolving relative file paths.
     * Defaults to process.cwd()
     */
    basePath?: string;

    /**
     * Current environment (e.g., 'dev', 'test', 'prod').
     * Defaults to process.env.NODE_ENV || 'dev'
     */
    environment?: string;

    /**
     * Whether to throw an error if a configuration file is not found.
     * Defaults to false (missing files are silently skipped).
     */
    throwOnMissingFile?: boolean;
}
