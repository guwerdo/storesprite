import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import type { IUnasJsonClient } from "@storesprite/unas-json-client";

vi.mock("../src/plugins/mikroOrm.js", () => ({
  default: Object.assign(async () => {}, { [Symbol.for("fastify.display-name")]: "mikroOrmPlugin" }),
}));

import { buildApp } from "../src/app.js";
import { TYPES, IUserService, ISettingService, User } from "../src/di/index.js";
import type { IUnasClientFactory } from "../src/types/UnasClientFactory.interface.js";
import { makeLoginResponse, makeWebshopInfo } from "./helpers/unasFixtures.js";

describe("UNAS login endpoint (mocked dependencies)", () => {
  let app: any;

  const mockUserService = mock<IUserService>();
  const mockSettingService = mock<ISettingService>();
  const mockFactory = mock<IUnasClientFactory>();
  const mockClient = mock<IUnasJsonClient>();

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    app.container.rebind(TYPES.IUserService).toConstantValue(mockUserService);
    app.container.rebind(TYPES.ISettingService).toConstantValue(mockSettingService);
    app.container.rebind(TYPES.IUnasClientFactory).toConstantValue(mockFactory);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Satisfy the JIT provisioning hook with an already-existing user
    (mockUserService.getUserById as any).mockResolvedValue(new User("mock_jwt_user_1", "dev@localhost", "Dev"));
    (mockFactory.create as any).mockReturnValue(mockClient);
  });

  it("should return 401 when Authorization header is missing", async () => {
    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
    });

    // Assert
    expect(response.statusCode).toBe(401);
  });

  it("should return 400 when no UNAS API key is configured", async () => {
    // Arrange
    (mockSettingService.getUserSettings as any).mockResolvedValue(null);

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });

    // Assert
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: "UNAS API key is not configured" });
  });

  it("should return webshop info on successful UNAS login", async () => {
    // Arrange
    const webshopInfo = makeWebshopInfo();
    (mockSettingService.getUserSettings as any).mockResolvedValue({
      unasApiKey: "test-key",
      unasApiEndpoint: "https://api.unas.eu/shop/",
      languageId: null,
    });
    (mockClient.login as any).mockResolvedValue(makeLoginResponse({ webshopInfo }));

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ webshopInfo });
    expect(mockClient.login).toHaveBeenCalledWith(true);
  });

  it("should return 502 when UNAS login fails", async () => {
    // Arrange
    (mockSettingService.getUserSettings as any).mockResolvedValue({
      unasApiKey: "test-key",
      unasApiEndpoint: "https://api.unas.eu/shop/",
      languageId: null,
    });
    (mockClient.login as any).mockRejectedValue(new Error("UNAS is unreachable"));

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });

    // Assert
    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.payload)).toEqual({ error: "UNAS login failed" });
  });
});
