import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { IUnasJsonClient } from "@storesprite/unas-json-client";
import { buildApp } from "../../src/app.js";
import { TYPES } from "../../src/di/index.js";
import type { IUnasClientFactory } from "../../src/types/UnasClientFactory.interface.js";
import { User } from "../../src/entities/User.js";
import { UserSetting } from "../../src/entities/UserSetting.js";
import { makeLoginResponse, makeWebshopInfo } from "../helpers/unasFixtures.js";

describe("E2E UNAS login API Tests (Isolated Test Database)", () => {
  let app: ReturnType<typeof buildApp>;

  const stubClient = mock<IUnasJsonClient>();

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Ensure schema and tables exist in test database
    if (app.orm) {
      const generator = app.orm.getSchemaGenerator();
      await generator.updateSchema();
    }

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

  it("should return webshop info when the user has a configured UNAS API key", async () => {
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
    expect(JSON.parse(response.payload)).toEqual({ webshopInfo });
    expect(stubClient.login).toHaveBeenCalledWith(true);
  });
});
