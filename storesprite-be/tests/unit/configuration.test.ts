import { describe, it, expect } from "vitest";
import { createContainer } from "../../src/di/container.js";
import { TYPES, type IConfiguration } from "../../src/di/types.js";
import { ConfigurationBuilder } from "@storesprite/app-config";

describe("Backend Configuration DI", () => {
  it("should resolve IConfiguration from Inversify container", () => {
    // Arrange
    const container = createContainer();

    // Act
    const config = container.get<IConfiguration>(TYPES.IConfiguration);

    // Assert
    expect(config).toBeDefined();
    expect(config.get<number>("server:port")).toBe(3000);
    expect(config.get<string>("server:host")).toBe("0.0.0.0");
  });

  it("should allow overriding IConfiguration for isolated backend tests", () => {
    // Arrange
    const container = createContainer();
    const testConfig = new ConfigurationBuilder()
      .addInMemoryCollection({
        server: { port: 8080, host: "127.0.0.1" },
        testMode: true,
      })
      .build();

    container.rebind<IConfiguration>(TYPES.IConfiguration).toConstantValue(testConfig);

    // Act
    const resolved = container.get<IConfiguration>(TYPES.IConfiguration);

    // Assert
    expect(resolved.get<number>("server:port")).toBe(8080);
    expect(resolved.get<string>("server:host")).toBe("127.0.0.1");
    expect(resolved.get<boolean>("testMode")).toBe(true);
  });
});
