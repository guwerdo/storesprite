import { EnvironmentVariablesConfigurationSource, JsonFileConfigurationSource, MemoryConfigurationSource } from "./configuration-sources.js";
import { IConfiguration, IConfigurationBuilderOptions, IConfigurationSource } from "./interfaces/configuration.interface.js";

/**
 * Implementation of IConfiguration that provides access to merged configuration data.
 */
class Configuration implements IConfiguration {
    // Flattened configuration with colon-separated keys
    private readonly flatConfig: Map<string, unknown>;

    // Nested configuration object
    private readonly nestedConfig: Record<string, unknown>;

    constructor(sources: Record<string, unknown>) {
        this.nestedConfig = sources;
        this.flatConfig = this.flatten(sources);
    }

    get<T>(key: string): T | undefined {
        // Support both "redis:connection:host" and "redis.connection.host"
        const normalizedKey = key.replace(/\./g, ":");
        return this.flatConfig.get(normalizedKey) as T | undefined;
    }

    getOrDefault<T>(key: string, defaultValue: T): T {
        const value = this.get<T>(key);
        return value !== undefined ? value : defaultValue;
    }

    getSection<T>(section: string): T | undefined {
        // Support both "redis:connection" and "redis.connection"
        const normalizedSection = section.replace(/\./g, ":");
        const sectionData = this.flatConfig.get(normalizedSection);

        if (sectionData !== undefined) {
            return sectionData as T;
        }

        // Try to reconstruct from nested config
        const parts = normalizedSection.split(":");
        let current: unknown = this.nestedConfig;

        for (const part of parts) {
            if (this.isRecord(current) && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }

        return current as T;
    }

    has(key: string): boolean {
        const normalizedKey = key.replace(/\./g, ":");
        return this.flatConfig.has(normalizedKey);
    }

    getAll(): Record<string, unknown> {
        return { ...this.nestedConfig };
    }

    /**
     * Flattens nested configuration into a Map with colon-separated keys.
     */
    private flatten(obj: Record<string, unknown>, prefix = ""): Map<string, unknown> {
        const map = new Map<string, unknown>();

        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}:${key}` : key;

            if (this.isRecord(value)) {
                // Store the nested object itself
                map.set(fullKey, value);
                // Also flatten its children
                const childMap = this.flatten(value, fullKey);
                childMap.forEach((v, k) => map.set(k, v));
            } else {
                map.set(fullKey, value);
            }
        }

        return map;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
}

/**
 * Builder for constructing IConfiguration instances from multiple sources.
 * Similar to .NET's ConfigurationBuilder.
 */
export class ConfigurationBuilder {
    private sources: IConfigurationSource[] = [];
    private options: IConfigurationBuilderOptions;

    constructor(options: IConfigurationBuilderOptions = {}) {
        this.options = {
            basePath: options.basePath || process.cwd(),
            environment: options.environment || process.env.NODE_ENV || "dev",
            throwOnMissingFile: options.throwOnMissingFile ?? false,
        };
    }

    /**
     * Adds a JSON configuration file.
     * @param filePath - Path to the JSON file (relative to basePath or absolute)
     * @param optional - If true, missing files won't throw errors
     */
    addJsonFile(filePath: string, optional = false): this {
        const priority = this.sources.length; // Order of addition determines priority
        this.sources.push(new JsonFileConfigurationSource(filePath, optional, priority));
        return this;
    }

    /**
     * Adds environment variables as a configuration source.
     * @param prefix - Optional prefix to filter environment variables (e.g., "CONFIG_")
     */
    addEnvironmentVariables(prefix?: string): this {
        const priority = this.sources.length; // Order of addition determines priority
        this.sources.push(new EnvironmentVariablesConfigurationSource(prefix, priority));
        return this;
    }

    /**
     * Adds an in-memory configuration source (useful for testing).
     */
    addInMemoryCollection(data: Record<string, unknown>): this {
        const priority = this.sources.length; // Order of addition determines priority
        this.sources.push(new MemoryConfigurationSource(data, priority));
        return this;
    }

    /**
     * Adds a custom configuration source.
     */
    addSource(source: IConfigurationSource): this {
        this.sources.push(source);
        return this;
    }

    /**
     * Builds and returns the final IConfiguration instance.
     * Sources are loaded in priority order (higher priority = loaded last = wins).
     */
    build(): IConfiguration {
        // Sort sources by priority
        const sortedSources = [...this.sources].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

        // Load and merge all sources
        let mergedConfig: Record<string, unknown> = {};

        for (const source of sortedSources) {
            const loaded = source.load();
            if (loaded instanceof Promise) {
                throw new Error("Async configuration sources are not supported by build().");
            }
            const data: Record<string, unknown> = loaded;
            mergedConfig = this.deepMerge(mergedConfig, data);
        }

        return new Configuration(mergedConfig);
    }

    /**
     * Creates a default configuration builder with standard .NET-like layering:
     * 1. configuration.json
     * 2. configuration.{Environment}.json
     * 3. Environment variables (with optional prefix)
     */
    static createDefault(options: IConfigurationBuilderOptions = {}): ConfigurationBuilder {
        const builder = new ConfigurationBuilder(options);
        const env = options.environment ?? process.env.NODE_ENV ?? "dev";
        const basePath = options.basePath ?? process.cwd();

        return builder
            .addJsonFile(`${basePath}/configuration/configuration.json`, true) // Base settings
            .addJsonFile(`${basePath}/configuration/configuration.${env}.json`, true) // Environment-specific
            .addEnvironmentVariables("CONFIG_"); // Environment variables with CONFIG_ prefix
    }

    /**
     * Deep merges two objects, with the second object taking precedence.
     */
    private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = { ...target };

        for (const [key, value] of Object.entries(source)) {
            if (this.isRecord(value)) {
                const existing = result[key];
                const existingRecord = this.isRecord(existing) ? existing : {};
                result[key] = this.deepMerge(existingRecord, value);
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
}
