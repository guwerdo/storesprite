import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "inversify";
import { injectable, inject } from "inversify";
import { ConfigurationBuilder } from "./configuration-builder.js";
import { BindingKeys } from "../types/binding-keys.js";
import { IRedisConfiguration } from "./interfaces/redis-configuration.interface.js";
import { IBullMqConfiguration } from "./interfaces/bullmq-configuration.interface.js";
import type { IConfiguration } from "./interfaces/configuration.interface.js";

@injectable()
class TestService {
    constructor(@inject(BindingKeys.IConfiguration) private configuration: IConfiguration) {}

    getRedisHost(): string {
        return this.configuration.get<string>("redis:connection:host") || "localhost";
    }

    getRedisConfig(): IRedisConfiguration | undefined {
        return this.configuration.getSection<IRedisConfiguration>("redis");
    }

    getBullMqConfiguration(): IBullMqConfiguration | undefined {
        return this.configuration.getSection<IBullMqConfiguration>("bullMq");
    }
}

describe("Configuration System", () => {
    describe("IConfiguration Interface", () => {
        it("should load configuration from default builder", () => {
            // Arrange
            const config = ConfigurationBuilder.createDefault().build();

            // Act & Assert
            expect(config.get<string>("redis:connection:host")).toBeDefined();
            expect(config.get<number>("redis:connection:port")).toBe(6379);
        });

        it("should support both colon and dot notation", () => {
            // Arrange
            const config = ConfigurationBuilder.createDefault().build();

            // Act & Assert
            expect(config.get<string>("redis:connection:host")).toBe(config.get<string>("redis.connection.host"));
        });

        it("should get sections as typed objects", () => {
            // Arrange
            const config = ConfigurationBuilder.createDefault().build();

            // Act
            const redisConfig = config.getSection<IRedisConfiguration>("redis");

            // Assert
            expect(redisConfig).toBeDefined();
            expect(redisConfig?.connection.host).toBeDefined();
            expect(redisConfig?.connection.port).toBe(6379);
        });

        it("should support getOrDefault for missing keys", () => {
            // Arrange
            const config = ConfigurationBuilder.createDefault().build();

            // Act
            const value = config.getOrDefault("nonexistent:key", "default-value");

            // Assert
            expect(value).toBe("default-value");
        });

        it("should check if keys exist", () => {
            // Arrange
            const config = ConfigurationBuilder.createDefault().build();

            // Act & Assert
            expect(config.has("redis:connection:host")).toBe(true);
            expect(config.has("nonexistent:key")).toBe(false);
        });
    });

    describe("Configuration Layering", () => {
        it("should override base config with environment-specific config", () => {
            // Arrange
            const config = new ConfigurationBuilder({ environment: "test" })
                .addInMemoryCollection({ redis: { connection: { host: "base-host" } } })
                .addInMemoryCollection({ redis: { connection: { host: "override-host" } } })
                .build();

            // Act
            const host = config.get<string>("redis:connection:host");

            // Assert - last source wins
            expect(host).toBe("override-host");
        });

        it("should deep merge nested configuration objects", () => {
            // Arrange
            const config = new ConfigurationBuilder()
                .addInMemoryCollection({
                    redis: { connection: { host: "base-host", port: 6379 } },
                })
                .addInMemoryCollection({
                    redis: { connection: { host: "override-host" } }, // Only override host
                })
                .build();

            // Act
            const redisConfig = config.getSection<IRedisConfiguration>("redis");

            // Assert - host is overridden, port is preserved
            expect(redisConfig?.connection.host).toBe("override-host");
            expect(redisConfig?.connection.port).toBe(6379);
        });

        it("should load environment variables with double underscore delimiter", () => {
            // Arrange
            process.env.CONFIG_REDIS__CONNECTION__HOST = "env-host";
            process.env.CONFIG_REDIS__CONNECTION__PORT = "9999";

            const config = new ConfigurationBuilder()
                .addInMemoryCollection({ redis: { connection: { host: "base-host", port: 6379 } } })
                .addEnvironmentVariables("CONFIG_")
                .build();

            // Act
            const host = config.get<string>("redis:connection:host");
            const port = config.get<number>("redis:connection:port");

            // Assert
            expect(host).toBe("env-host");
            expect(port).toBe(9999);

            // Cleanup
            delete process.env.CONFIG_REDIS__CONNECTION__HOST;
            delete process.env.CONFIG_REDIS__CONNECTION__PORT;
        });
    });

    describe("Testing with Custom Configuration", () => {
        let testContainer: Container;

        beforeEach(() => {
            testContainer = new Container();
        });

        it("should allow overriding configuration for tests", () => {
            // Arrange - Create test-specific configuration
            const testConfig = new ConfigurationBuilder()
                .addInMemoryCollection({
                    redis: { connection: { host: "test-redis", port: 6379 } },
                    bullMq: { queue: { parsed: "test-parsed-queue", translated: "test-translated-queue" } },
                })
                .build();

            // Bind test configuration to container
            testContainer.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(testConfig);
            testContainer.bind<TestService>(TestService).toSelf();

            // Act
            const service = testContainer.get<TestService>(TestService);
            const bullMqConfiguration = service.getBullMqConfiguration();

            // Assert
            expect(service.getRedisHost()).toBe("test-redis");
            expect(bullMqConfiguration).toBeDefined();
            expect(bullMqConfiguration?.queue.parsed).toBe("test-parsed-queue");
            expect(bullMqConfiguration?.queue.translated).toBe("test-translated-queue");
        });

        it("should allow partial configuration overrides for specific tests", () => {
            // Arrange - Load base config and override only specific values
            const baseConfig = ConfigurationBuilder.createDefault().build();
            const testConfig = new ConfigurationBuilder()
                .addInMemoryCollection(baseConfig.getAll()) // Start with base config
                .addInMemoryCollection({
                    // Override only bullMq for this specific test
                    bullMq: { queue: { parsed: "test-parsed-queue", translated: "test-translated-queue" } },
                })
                .build();

            testContainer.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(testConfig);
            testContainer.bind<TestService>(TestService).toSelf();

            // Act
            const service = testContainer.get<TestService>(TestService);

            // Assert - queue names is overridden, but redis config is from base
            expect(service.getBullMqConfiguration()).toBeDefined();
            expect(service.getBullMqConfiguration()?.queue.parsed).toBe("test-parsed-queue");
            expect(service.getBullMqConfiguration()?.queue.translated).toBe("test-translated-queue");
            expect(service.getRedisConfig()).toBeDefined();
        });

        it("should support environment-based configuration in tests", () => {
            // Arrange - Explicitly set environment to 'test'
            const testConfig = ConfigurationBuilder.createDefault({ environment: "test" }).build();

            testContainer.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(testConfig);
            testContainer.bind<TestService>(TestService).toSelf();

            // Act
            testContainer.get<TestService>(TestService);
            const bullMqConfiguration = testConfig.getSection<IBullMqConfiguration>("bullMq");

            // Assert - test environment should have test queues enabled (from configuration.test.json)
            expect(bullMqConfiguration?.queue.parsed).toBe("parsed-data-queue-test");
            expect(bullMqConfiguration?.queue.translated).toBe("translated-data-queue-test");
        });
    });

    describe("Integration with Dependency Injection", () => {
        it("should inject IConfiguration into services", () => {
            // Arrange
            const container = new Container();
            const config = ConfigurationBuilder.createDefault().build();

            container.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(config);
            container.bind<TestService>(TestService).toSelf();

            // Act
            const service = container.get<TestService>(TestService);

            // Assert
            expect(service.getRedisHost()).toBeDefined();
            expect(service.getRedisConfig()).toBeDefined();
        });
    });
});
