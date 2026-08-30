import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/entities/User.js";
import { Language } from "../../src/entities/Language.js";
import { UserSetting } from "../../src/entities/UserSetting.js";

describe("Settings API Integration Tests (Isolated Test Database)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Ensure schema and tables exist in test database
    if (app.orm) {
      const generator = app.orm.getSchemaGenerator();
      await generator.updateSchema();
    }
  });

  beforeEach(async () => {
    // Reset test database tables before each test
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(UserSetting, {});
      await em.nativeDelete(Language, {});
      await em.nativeDelete(User, {});

      // Seed initial languages
      const en = new Language("en-us");
      const hu = new Language("hu");
      await em.persistAndFlush([en, hu]);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/client/settings", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/client/settings",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return null settings and available languages for a newly authenticated user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/client/settings",
        headers: {
          authorization: "Bearer mock_jwt_token_user_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.settings).toBeNull();
      expect(body.languages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "en-us" }),
          expect.objectContaining({ code: "hu" }),
        ])
      );
    });
  });

  describe("PUT /api/client/settings", () => {
    it("should save and persist user settings in PostgreSQL", async () => {
      // 1. Get available language ID
      const em = app.orm!.em.fork();
      const huLang = await em.findOne(Language, { code: "hu" });
      expect(huLang).not.toBeNull();

      // 2. Send PUT request to save settings
      const putResponse = await app.inject({
        method: "PUT",
        url: "/api/client/settings",
        headers: {
          authorization: "Bearer mock_jwt_token_user_1",
        },
        payload: {
          unasApiKey: "test_unas_api_key_12345",
          unasApiEndpoint: "https://custom.unas.eu/shop/",
          languageId: huLang!.id,
        },
      });

      expect(putResponse.statusCode).toBe(200);
      const putBody = JSON.parse(putResponse.payload);
      expect(putBody.success).toBe(true);
      expect(putBody.settings).toEqual({
        unasApiKey: "test_unas_api_key_12345",
        unasApiEndpoint: "https://custom.unas.eu/shop/",
        languageId: huLang!.id,
        timezone: "Europe/Budapest",
      });

      // 3. Verify subsequent GET request returns the persisted settings
      const getResponse = await app.inject({
        method: "GET",
        url: "/api/client/settings",
        headers: {
          authorization: "Bearer mock_jwt_token_user_1",
        },
      });

      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.payload);
      expect(getBody.settings).toEqual({
        unasApiKey: "test_unas_api_key_12345",
        unasApiEndpoint: "https://custom.unas.eu/shop/",
        languageId: huLang!.id,
        unasConnection: null,
        timezone: "Europe/Budapest",
      });

      // 4. Verify directly in database via MikroORM
      const freshEm = app.orm!.em.fork();
      const savedSetting = await freshEm.findOne(
        UserSetting,
        { unasApiKey: "test_unas_api_key_12345" },
        { populate: ["language", "user"] }
      );
      expect(savedSetting).not.toBeNull();
      expect(savedSetting?.unasApiEndpoint).toBe("https://custom.unas.eu/shop/");
      expect(savedSetting?.language?.code).toBe("hu");
    });

    it("should save and persist a timezone", async () => {
      const putResponse = await app.inject({
        method: "PUT",
        url: "/api/client/settings",
        headers: { authorization: "Bearer mock_jwt_token_user_1" },
        payload: {
          unasApiKey: "tz_key_12345",
          timezone: "Europe/Vienna",
        },
      });

      expect(putResponse.statusCode).toBe(200);
      const putBody = JSON.parse(putResponse.payload);
      expect(putBody.settings.timezone).toBe("Europe/Vienna");

      const getResponse = await app.inject({
        method: "GET",
        url: "/api/client/settings",
        headers: { authorization: "Bearer mock_jwt_token_user_1" },
      });
      expect(getResponse.statusCode).toBe(200);
      expect(JSON.parse(getResponse.payload).settings.timezone).toBe("Europe/Vienna");
    });

    it("rejects an invalid timezone", async () => {
      const putResponse = await app.inject({
        method: "PUT",
        url: "/api/client/settings",
        headers: { authorization: "Bearer mock_jwt_token_user_1" },
        payload: { unasApiKey: "tz_key_12345", timezone: "Invalid/Timezone" },
      });

      expect(putResponse.statusCode).toBe(400);
    });
  });
});
