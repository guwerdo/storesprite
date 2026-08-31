import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { UnasHttpError, UnasTransportError, type IUnasJsonClient } from "@storesprite/unas-json-client";

vi.mock("../../../src/plugins/mikroOrm.js", () => ({
  default: Object.assign(async () => {}, { [Symbol.for("fastify.display-name")]: "mikroOrmPlugin" }),
}));

import { buildApp } from "../../../src/app.js";
import { TYPES, IUserService, ISettingService, User } from "../../../src/di/index.js";
import type { IUnasClientFactory } from "../../../src/types/unas/UnasClientFactory.interface.js";
import { makeLoginResponse, makeWebshopInfo } from "../../helpers/unasFixtures.js";

describe("UNAS login endpoint (mocked dependencies)", () => {
  let app: any;

  const mockUserService = mock<IUserService>();
  const mockSettingService = mock<ISettingService>();
  const mockFactory = mock<IUnasClientFactory>();
  const mockClient = mock<IUnasJsonClient>();

  const settingsWithKey = {
    unasApiKey: "test-key",
    unasApiEndpoint: "https://api.unas.eu/shop/",
    languageId: null,
  };

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
    vi.clearAllMocks();
    (mockUserService.getUserById as any).mockResolvedValue(new User("mock_jwt_user_1", "dev@localhost", "Dev"));
    (mockFactory.create as any).mockReturnValue(mockClient);
  });

  it("should return 401 when Authorization header is missing", async () => {
    // Act
    const response = await app.inject({ method: "POST", url: "/api/client/unas/login" });

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

  it("should save the connection and return webshop info on success", async () => {
    // Arrange
    const webshopInfo = makeWebshopInfo();
    (mockSettingService.getUserSettings as any).mockResolvedValue(settingsWithKey);
    (mockClient.login as any).mockResolvedValue(makeLoginResponse({ webshopInfo }));

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      connection: expect.objectContaining({
        token: null,
        checkedAt: expect.any(String),
        shopId: 83219,
        webshopInfo,
      }),
    });
    expect(mockClient.login).toHaveBeenCalledWith(true);
    expect(mockSettingService.saveUnasConnection).toHaveBeenCalledWith(
      "mock_jwt_user_1",
      expect.objectContaining({
        token: null,
        checkedAt: expect.any(String),
        shopId: 83219,
        webshopInfo,
      })
    );
  });

  it("should reset the connection and return 502 on a non-2xx UNAS response", async () => {
    // Arrange
    (mockSettingService.getUserSettings as any).mockResolvedValue(settingsWithKey);
    (mockClient.login as any).mockRejectedValue(
      new UnasHttpError("Login Error: invalid ApiKey", 400, "https://api.unas.eu/shop/login")
    );

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });

    // Assert
    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.payload)).toEqual({ error: "UNAS login failed" });
    expect(mockSettingService.saveUnasConnection).toHaveBeenCalledWith("mock_jwt_user_1", null);
  });

  it("should NOT reset the connection on a network/transport error", async () => {
    // Arrange
    (mockSettingService.getUserSettings as any).mockResolvedValue(settingsWithKey);
    (mockClient.login as any).mockRejectedValue(new UnasTransportError("network timeout"));

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });

    // Assert
    expect(response.statusCode).toBe(502);
    expect(mockSettingService.saveUnasConnection).not.toHaveBeenCalled();
  });
});
