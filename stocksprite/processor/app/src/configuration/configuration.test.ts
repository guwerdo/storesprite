import { describe, it, expect, beforeEach } from "vitest";
import { Container, injectable, inject } from "inversify";
import { ConfigurationBuilder, type IConfiguration } from "@storesprite/app-config";
import { BindingKeys } from "../types/binding-keys.js";
import { IRedisConfiguration } from "./interfaces/redis-configuration.interface.js";
import { IBullMqConfiguration } from "./interfaces/bullmq-configuration.interface.js";

@injectable()
class TestWorkerService {
    constructor(@inject(BindingKeys.IConfiguration) private _config: IConfiguration) {}

    public getRedisConfig(): IRedisConfiguration | undefined {
        return this._config.getSection<IRedisConfiguration>("redis");
    }

    public getBullMqConfig(): IBullMqConfiguration | undefined {
        return this._config.getSection<IBullMqConfiguration>("bullMq");
    }
}

describe("Stocksprite Configuration DI Integration", () => {
    let container: Container;

    beforeEach(() => {
        container = new Container();
    });

    it("should inject IConfiguration into worker services and resolve domain sections", () => {
        // Arrange
        const config = ConfigurationBuilder.createDefault().build();
        container.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(config);
        container.bind<TestWorkerService>(TestWorkerService).toSelf();

        // Act
        const service = container.get<TestWorkerService>(TestWorkerService);
        const redisConfig = service.getRedisConfig();
        const bullMqConfig = service.getBullMqConfig();

        // Assert
        expect(redisConfig).toBeDefined();
        expect(redisConfig?.connection.host).toBeDefined();
        expect(bullMqConfig).toBeDefined();
        expect(bullMqConfig?.queue.parsed).toBeDefined();
    });

    it("should allow in-memory test overrides in worker service tests", () => {
        // Arrange
        const testConfig = new ConfigurationBuilder()
            .addInMemoryCollection({
                redis: { connection: { host: "mock-redis", port: 6379 } },
                bullMq: { queue: { parsed: "test-queue" } },
            })
            .build();

        container.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(testConfig);
        container.bind<TestWorkerService>(TestWorkerService).toSelf();

        // Act
        const service = container.get<TestWorkerService>(TestWorkerService);

        // Assert
        expect(service.getRedisConfig()?.connection.host).toBe("mock-redis");
        expect(service.getBullMqConfig()?.queue.parsed).toBe("test-queue");
    });
});
