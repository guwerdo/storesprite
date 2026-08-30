import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { UnasHttpError, type IUnasJsonClient } from "@storesprite/unas-json-client";
import { buildApp } from "../../src/app.js";
import { TYPES } from "../../src/di/index.js";
import type { IUnasClientFactory } from "../../src/types/UnasClientFactory.interface.js";
import { User } from "../../src/entities/User.js";
import { UserSetting } from "../../src/entities/UserSetting.js";
import { makeLoginResponse, makeUnasConnectionRecord, makeWebshopInfo } from "../helpers/unasFixtures.js";
import { resetTestDatabase } from "../helpers/testDatabase.js";

describe("UNAS login API Integration Tests (Isolated Test Database)", () => {
  let app: ReturnType<typeof buildApp>;

  const stubClient = mock<IUnasJsonClient>();

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    await resetTestDatabase(app);

    // Stub the UNAS client factory so no real UNAS HTTP call is made
    const stubFactory: IUnasClientFactory = {
      create: () => stubClient,
    };
    app.container.rebind(TYPES.IUnasClientFactory).toConstantValue(stubFactory);
  });

  beforeEach(async () => {
    // Reset test database tables before each test
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(UserSetting, {});
      await em.nativeDelete(User, {});
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 when Authorization header is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
    });

    expect(response.statusCode).toBe(401);
  });

  it("should return 400 when the authenticated user has no configured UNAS API key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/client/unas/login",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toEqual({ error: "UNAS API key is not configured" });
  });

  it("should persist the connection (token redacted) and expose it via GET /settings", async () => {
    // Arrange: seed user + settings with an API key
    const em = app.orm!.em.fork();
    const user = new User("mock_jwt_user_1", "mock_jwt_user_1@dev.test", "Mock");
    await em.persistAndFlush(user);
    await em.persistAndFlush(new UserSetting(user, "test_unas_api_key"));

    const webshopInfo = makeWebshopInfo();
    (stubClient.login as any).mockResolvedValue(makeLoginResponse({ webshopInfo }));

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
    expect(stubClient.login).toHaveBeenCalledWith(true);

    // Verify persisted JSONB in the database (token redacted, checkedAt present)
    const freshEm = app.orm!.em.fork();
    const saved = await freshEm.findOne(UserSetting, { user: { id: "mock_jwt_user_1" } });
    expect(saved?.unasConnection).not.toBeNull();
    expect(saved?.unasConnection?.token).toBeNull();
    expect(saved?.unasConnection?.shopId).toBe(83219);
    expect(saved?.unasConnection?.webshopInfo?.webshopName).toBe("Test Webshop");
    expect(saved?.unasConnection?.checkedAt).toEqual(expect.any(String));

    // Verify GET /api/client/settings exposes it too
    const settingsResponse = await app.inject({
      method: "GET",
      url: "/api/client/settings",
      headers: { authorization: "Bearer mock_jwt_user_1" },
    });
    expect(settingsResponse.statusCode).toBe(200);
    const settingsBody = JSON.parse(settingsResponse.payload);
    expect(settingsBody.settings.unasConnection).not.toBeNull();
    expect(settingsBody.settings.unasConnection.shopId).toBe(83219);
  });

  it("should reset the connection to null on a non-2xx UNAS response", async () => {
    // Arrange: seed user + settings that already have a stored connection
    const em = app.orm!.em.fork();
    const user = new User("mock_jwt_user_1", "mock_jwt_user_1@dev.test", "Mock");
    await em.persistAndFlush(user);

    const existingConnection = makeUnasConnectionRecord();
    await em.persistAndFlush(new UserSetting(user, "test_unas_api_key", null, undefined, existingConnection));

    (stubClient.login as any).mockRejectedValue(
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

    const freshEm = app.orm!.em.fork();
    const saved = await freshEm.findOne(UserSetting, { user: { id: "mock_jwt_user_1" } });
    expect(saved?.unasConnection).toBeNull();
  });
});
