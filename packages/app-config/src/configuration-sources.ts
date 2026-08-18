import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { IConfigurationSource } from "./interfaces/configuration.interface.js";

/**
 * Loads configuration from a JSON file.
 */
export class JsonFileConfigurationSource implements IConfigurationSource {
    constructor(
        private readonly filePath: string,
        private readonly optional = false,
        public readonly priority = 0,
    ) {}

    load(): Record<string, unknown> {
        try {
            const absolutePath = resolve(this.filePath);
            const content = readFileSync(absolutePath, "utf-8");
            const parsed: unknown = JSON.parse(content);
            if (this.isRecord(parsed)) {
                return parsed;
            }

            throw new Error(`Configuration file '${this.filePath}' must contain a JSON object at the root.`);
        } catch (error) {
            if (this.optional) {
                return {};
            }
            throw new Error(`Failed to load configuration file '${this.filePath}': ${String(error)}`);
        }
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
}

/**
 * Loads configuration from environment variables.
 * Supports nested keys using double underscores (e.g., REDIS__CONNECTION__HOST -> redis.connection.host)
 */
export class EnvironmentVariablesConfigurationSource implements IConfigurationSource {
    constructor(
        private readonly prefix?: string,
        public readonly priority = 100,
    ) {}

    load(): Record<string, unknown> {
        const config: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(process.env)) {
            // Skip if prefix is specified and key doesn't start with it
            if (this.prefix && !key.startsWith(this.prefix)) {
                continue;
            }

            // Remove prefix if present
            const normalizedKey = this.prefix ? key.substring(this.prefix.length) : key;

            // Convert REDIS__CONNECTION__HOST to redis.connection.host
            const path = normalizedKey.toLowerCase().split("__");

            // Set the value in nested structure
            let current: Record<string, unknown> = config;
            for (let i = 0; i < path.length - 1; i++) {
                const segment = path[i];
                const existing = current[segment];
                if (!this.isRecord(existing)) {
                    current[segment] = {};
                }
                current = current[segment] as Record<string, unknown>;
            }

            const lastSegment = path[path.length - 1];
            current[lastSegment] = this.parseValue(value ?? "");
        }

        return config;
    }

    private parseValue(value: string): unknown {
        // Try to parse as JSON (handles numbers, booleans, arrays, objects)
        try {
            const parsed: unknown = JSON.parse(value);
            return parsed;
        } catch {
            return value;
        }
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
}

/**
 * Loads configuration from an in-memory object.
 * Useful for testing or programmatic configuration overrides.
 */
export class MemoryConfigurationSource implements IConfigurationSource {
    constructor(
        private readonly data: Record<string, unknown>,
        public readonly priority = 200,
    ) {}

    load(): Record<string, unknown> {
        return this.data;
    }
}
