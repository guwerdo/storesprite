import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/entities/User.js";
import { DataConnection } from "../../src/entities/DataConnection.js";

describe("E2E Connections API Tests", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    if (app.orm) {
      const generator = app.orm.getSchemaGenerator();
      await generator.updateSchema();
    }
  });

  beforeEach(async () => {
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/client/connections", () => {
    it("should return empty list when no connections exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/client/connections",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.connections).toEqual([]);
    });
  });

  describe("POST & GET /api/client/connections CRUD", () => {
    it("should create, fetch, update and delete a data connection", async () => {
      // 1. Create HTTP / CSV connection
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/client/connections",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "Magictools Feed",
          channel: "HTTP",
          dataFormat: "CSV",
          config: {
            channel: "HTTP",
            url: "https://media.magictools.hu/shared/products.csv",
            method: "GET",
            insecureIgnoreSsl: true,
            timeoutSeconds: 30,
          },
          dataFormatConfig: {
            format: "CSV",
            delimiter: ";",
            encoding: "UTF-8",
            hasHeaders: true,
          },
          isActive: true,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.payload);
      expect(createBody.success).toBe(true);
      expect(createBody.connection.name).toBe("Magictools Feed");
      expect(createBody.connection.id).toBeDefined();

      const connectionId = createBody.connection.id;

      // 2. Fetch connection by ID
      const getResponse = await app.inject({
        method: "GET",
        url: `/api/client/connections/${connectionId}`,
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
      });

      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.payload);
      expect(getBody.connection.id).toBe(connectionId);
      expect(getBody.connection.channel).toBe("HTTP");

      // 3. Update connection name
      const updateResponse = await app.inject({
        method: "PUT",
        url: `/api/client/connections/${connectionId}`,
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "Magictools Feed (Updated)",
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updateBody = JSON.parse(updateResponse.payload);
      expect(updateBody.connection.name).toBe("Magictools Feed (Updated)");

      // 4. Delete connection
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/client/connections/${connectionId}`,
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
      });

      expect(deleteResponse.statusCode).toBe(200);

      // 5. Verify deleted
      const verifyResponse = await app.inject({
        method: "GET",
        url: `/api/client/connections/${connectionId}`,
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
      });

      expect(verifyResponse.statusCode).toBe(404);
    });
  });
});
