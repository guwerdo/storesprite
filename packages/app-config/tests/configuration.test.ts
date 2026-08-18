import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { ConfigurationBuilder } from "../src/configuration-builder.js";
import { JsonFileConfigurationSource, EnvironmentVariablesConfigurationSource, MemoryConfigurationSource } from "../src/configuration-sources.js";
import type { IConfiguration, IConfigurationSource } from "../src/interfaces/configuration.interface.js";

interface ITestSection {
    connection: {
        host: string;
        port: number;
    };
    timeout?: number;
    enabled?: boolean;
    tags?: string[];
}

describe("@storesprite/app-config Comprehensive Test Suite", () => {
    const tempDir = resolve("./temp-test-config");

    beforeEach(() => {
        if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe("IConfiguration Interface Operations", () => {
        it("should retrieve primitives, booleans, numbers, arrays, and objects", () => {
            // Arrange
            const config = new ConfigurationBuilder()
                .addInMemoryCollection({
                    strVal: "hello",
                    numVal: 42,
                    boolValTrue: true,
                    boolValFalse: false,
                    arrVal: [1, 2, "three"],
                    nested: {
                        deep: {
                            key: "deep-value",
                        },
                    },
                })
                .build();

            // Act & Assert
            expect(config.get<string>("strVal")).toBe("hello");
            expect(config.get<number>("numVal")).toBe(42);
            expect(config.get<boolean>("boolValTrue")).toBe(true);
            expect(config.get<boolean>("boolValFalse")).toBe(false);
            expect(config.get<unknown[]>("arrVal")).toEqual([1, 2, "three"]);
            expect(config.get<string>("nested:deep:key")).toBe("deep-value");
            expect(config.get<string>("nested.deep.key")).toBe("deep-value");
        });

        it("should return undefined for non-existent keys with get()", () => {
            const config = new ConfigurationBuilder().build();
            expect(config.get<string>("does:not:exist")).toBeUndefined();
        });

        it("should return defaultValue when key is missing with getOrDefault()", () => {
            const config = new ConfigurationBuilder().build();
            expect(config.getOrDefault<number>("timeout:ms", 3000)).toBe(3000);
            expect(config.getOrDefault<string>("mode", "default-mode")).toBe("default-mode");
        });

        it("should return actual value even if falsey (false, 0, '') with getOrDefault()", () => {
            const config = new ConfigurationBuilder()
                .addInMemoryCollection({
                    zeroNum: 0,
                    emptyStr: "",
                    falseBool: false,
                })
                .build();

            expect(config.getOrDefault<number>("zeroNum", 999)).toBe(0);
            expect(config.getOrDefault<string>("emptyStr", "fallback")).toBe("");
            expect(config.getOrDefault<boolean>("falseBool", true)).toBe(false);
        });

        it("should check existence accurately with has()", () => {
            const config = new ConfigurationBuilder()
                .addInMemoryCollection({
                    existingKey: "value",
                    nested: { child: 10 },
                    nullVal: null,
                })
                .build();

            expect(config.has("existingKey")).toBe(true);
            expect(config.has("nested:child")).toBe(true);
            expect(config.has("nested.child")).toBe(true);
            expect(config.has("nonExistingKey")).toBe(false);
            expect(config.has("nested:unknown")).toBe(false);
        });

        it("should return entire snapshot with getAll()", () => {
            const initialData = {
                app: { name: "test-app", version: 1 },
                env: "unit-test",
            };
            const config = new ConfigurationBuilder().addInMemoryCollection(initialData).build();

            expect(config.getAll()).toEqual(initialData);
        });

        it("should extract typed section with getSection<T>()", () => {
            const config = new ConfigurationBuilder()
                .addInMemoryCollection({
                    redis: {
                        connection: { host: "127.0.0.1", port: 6379 },
                        timeout: 5000,
                        enabled: true,
                        tags: ["cache", "session"],
                    },
                })
                .build();

            const section = config.getSection<ITestSection>("redis");
            expect(section).toBeDefined();
            expect(section?.connection.host).toBe("127.0.0.1");
            expect(section?.connection.port).toBe(6379);
            expect(section?.timeout).toBe(5000);
            expect(section?.enabled).toBe(true);
            expect(section?.tags).toEqual(["cache", "session"]);
        });

        it("should return undefined when getSection<T>() does not exist", () => {
            const config = new ConfigurationBuilder().build();
            expect(config.getSection<ITestSection>("nonexistentSection")).toBeUndefined();
        });
    });

    describe("JsonFileConfigurationSource", () => {
        it("should successfully load valid JSON configuration from disk", () => {
            const filePath = join(tempDir, "valid-config.json");
            writeFileSync(filePath, JSON.stringify({ db: { port: 5432, host: "db-host" } }), "utf-8");

            const config = new ConfigurationBuilder().addJsonFile(filePath).build();

            expect(config.get<number>("db:port")).toBe(5432);
            expect(config.get<string>("db:host")).toBe("db-host");
        });

        it("should ignore missing file when optional is true", () => {
            const filePath = join(tempDir, "missing-optional.json");
            expect(() => {
                new ConfigurationBuilder().addJsonFile(filePath, true).build();
            }).not.toThrow();
        });

        it("should throw error when missing file and optional is false", () => {
            const filePath = join(tempDir, "missing-required.json");
            expect(() => {
                new ConfigurationBuilder().addJsonFile(filePath, false).build();
            }).toThrow(/Failed to load configuration file/);
        });

        it("should throw error if JSON file contains invalid JSON syntax and optional is false", () => {
            const filePath = join(tempDir, "malformed.json");
            writeFileSync(filePath, "{ invalid json syntax: true", "utf-8");

            expect(() => {
                new ConfigurationBuilder().addJsonFile(filePath, false).build();
            }).toThrow(/Failed to load configuration file/);
        });

        it("should throw error if JSON root is not an object (e.g. primitive or array)", () => {
            const filePath = join(tempDir, "array-root.json");
            writeFileSync(filePath, JSON.stringify(["not", "an", "object"]), "utf-8");

            expect(() => {
                const source = new JsonFileConfigurationSource(filePath, false);
                source.load();
            }).toThrow(/must contain a JSON object at the root/);
        });
    });

    describe("EnvironmentVariablesConfigurationSource", () => {
        it("should map double underscores to nested configuration properties", () => {
            process.env.CONFIG_SERVER__HTTP__PORT = "8080";
            process.env.CONFIG_SERVER__HTTP__SSL = "true";
            process.env.CONFIG_SERVER__NAME = "StoreSpriteWorker";

            const config = new ConfigurationBuilder().addEnvironmentVariables("CONFIG_").build();

            expect(config.get<number>("server:http:port")).toBe(8080);
            expect(config.get<boolean>("server:http:ssl")).toBe(true);
            expect(config.get<string>("server:name")).toBe("StoreSpriteWorker");

            delete process.env.CONFIG_SERVER__HTTP__PORT;
            delete process.env.CONFIG_SERVER__HTTP__SSL;
            delete process.env.CONFIG_SERVER__NAME;
        });

        it("should automatically parse JSON primitive types in environment variable values", () => {
            process.env.CONFIG_FLAG_TRUE = "true";
            process.env.CONFIG_FLAG_FALSE = "false";
            process.env.CONFIG_COUNT = "100";
            process.env.CONFIG_FLOAT = "3.1415";
            process.env.CONFIG_JSON_ARRAY = "[1,2,3]";
            process.env.CONFIG_RAW_STRING = "plain text string";

            const config = new ConfigurationBuilder().addEnvironmentVariables("CONFIG_").build();

            expect(config.get<boolean>("flag_true")).toBe(true);
            expect(config.get<boolean>("flag_false")).toBe(false);
            expect(config.get<number>("count")).toBe(100);
            expect(config.get<number>("float")).toBe(3.1415);
            expect(config.get<number[]>("json_array")).toEqual([1, 2, 3]);
            expect(config.get<string>("raw_string")).toBe("plain text string");

            delete process.env.CONFIG_FLAG_TRUE;
            delete process.env.CONFIG_FLAG_FALSE;
            delete process.env.CONFIG_COUNT;
            delete process.env.CONFIG_FLOAT;
            delete process.env.CONFIG_JSON_ARRAY;
            delete process.env.CONFIG_RAW_STRING;
        });

        it("should ignore environment variables not matching prefix", () => {
            process.env.OTHER_APP_SETTING = "ignored";
            process.env.CONFIG_INCLUDED_SETTING = "included";

            const config = new ConfigurationBuilder().addEnvironmentVariables("CONFIG_").build();

            expect(config.get<string>("included_setting")).toBe("included");
            expect(config.get<string>("other_app_setting")).toBeUndefined();

            delete process.env.OTHER_APP_SETTING;
            delete process.env.CONFIG_INCLUDED_SETTING;
        });
    });

    describe("Multi-Source Layering & Precedence", () => {
        it("should respect precedence order: later added sources overwrite earlier sources", () => {
            const config = new ConfigurationBuilder()
                .addInMemoryCollection({ service: { name: "source1", port: 1000, timeout: 5000 } })
                .addInMemoryCollection({ service: { name: "source2", port: 2000 } })
                .addInMemoryCollection({ service: { name: "source3" } })
                .build();

            expect(config.get<string>("service:name")).toBe("source3");
            expect(config.get<number>("service:port")).toBe(2000);
            expect(config.get<number>("service:timeout")).toBe(5000);
        });

        it("should deeply merge nested configurations without wiping unmentioned subproperties", () => {
            const config = new ConfigurationBuilder()
                .addInMemoryCollection({
                    nested: {
                        level1: {
                            a: 1,
                            b: 2,
                            c: 3,
                        },
                    },
                })
                .addInMemoryCollection({
                    nested: {
                        level1: {
                            b: 999, // Override only 'b'
                        },
                    },
                })
                .build();

            expect(config.get<number>("nested:level1:a")).toBe(1);
            expect(config.get<number>("nested:level1:b")).toBe(999);
            expect(config.get<number>("nested:level1:c")).toBe(3);
        });

        it("should handle custom priority ordering of sources", () => {
            class CustomHighPrioritySource implements IConfigurationSource {
                public readonly priority = 999;
                public load(): Record<string, unknown> {
                    return { priorityKey: "wins-due-to-priority" };
                }
            }

            class CustomLowPrioritySource implements IConfigurationSource {
                public readonly priority = 1;
                public load(): Record<string, unknown> {
                    return { priorityKey: "loses-due-to-low-priority" };
                }
            }

            // Even if HighPrioritySource is added first, its priority should make it win
            const config = new ConfigurationBuilder()
                .addSource(new CustomHighPrioritySource())
                .addSource(new CustomLowPrioritySource())
                .build();

            expect(config.get<string>("priorityKey")).toBe("wins-due-to-priority");
        });

        it("should throw error if an asynchronous configuration source is used synchronously in build()", () => {
            class AsyncSource implements IConfigurationSource {
                public load(): Promise<Record<string, unknown>> {
                    return Promise.resolve({ asyncVal: true });
                }
            }

            expect(() => {
                new ConfigurationBuilder().addSource(new AsyncSource()).build();
            }).toThrow(/Async configuration sources are not supported/);
        });
    });

    describe("ConfigurationBuilder.createDefault()", () => {
        it("should load base and environment files from basePath", () => {
            const configDir = join(tempDir, "configuration");
            mkdirSync(configDir, { recursive: true });

            writeFileSync(
                join(configDir, "configuration.json"),
                JSON.stringify({ server: { port: 3000, env: "base" } }),
                "utf-8"
            );
            writeFileSync(
                join(configDir, "configuration.staging.json"),
                JSON.stringify({ server: { env: "staging-override" } }),
                "utf-8"
            );

            process.env.CONFIG_SERVER__PORT = "4000";

            const config = ConfigurationBuilder.createDefault({
                basePath: tempDir,
                environment: "staging",
            }).build();

            expect(config.get<string>("server:env")).toBe("staging-override");
            expect(config.get<number>("server:port")).toBe(4000);

            delete process.env.CONFIG_SERVER__PORT;
        });
    });
});
