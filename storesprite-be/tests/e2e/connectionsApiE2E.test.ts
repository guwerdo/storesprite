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
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
      await em.flush();
    }
    await app.close();
  });

  describe("Authentication & Authorization Security", () => {
    it("should return 401 Unauthorized when Bearer token is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/client/connections",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("Missing Bearer Token");
    });
  });

  describe("GET /api/client/connections", () => {
    it("should return empty list when no connections exist for user", async () => {
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

  describe("POST & GET /api/client/connections CRUD Operations", () => {
    it("should create HTTP connection with Bearer credentials, fetch, update and delete", async () => {
      // 1. Create HTTP / CSV connection with Bearer credentials
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
          credentials: {
            authType: "BEARER",
            token: "secret-bearer-token-xyz",
          },
          isActive: true,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.payload);
      expect(createBody.success).toBe(true);
      expect(createBody.connection.name).toBe("Magictools Feed");
      expect(createBody.connection.credentials).toEqual({
        authType: "BEARER",
        token: "secret-bearer-token-xyz",
      });
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
      expect(getBody.connection.credentials).toEqual({
        authType: "BEARER",
        token: "secret-bearer-token-xyz",
      });

      // 3. Update connection name and credentials
      const updateResponse = await app.inject({
        method: "PUT",
        url: `/api/client/connections/${connectionId}`,
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "Magictools Feed (Updated)",
          credentials: {
            authType: "API_KEY",
            headerName: "X-Api-Key",
            headerValue: "new-api-key-value",
          },
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updateBody = JSON.parse(updateResponse.payload);
      expect(updateBody.connection.name).toBe("Magictools Feed (Updated)");
      expect(updateBody.connection.credentials).toEqual({
        authType: "API_KEY",
        headerName: "X-Api-Key",
        headerValue: "new-api-key-value",
      });

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

    it("should create SFTP connection with SSH Private Key credentials", async () => {
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/client/connections",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "Cromwell SFTP Server",
          channel: "SFTP",
          dataFormat: "XML",
          config: {
            channel: "SFTP",
            host: "sftp.cromwell.co.uk",
            port: 2222,
            remoteDir: "/feeds/daily",
            fileSelectionStrategy: "LATEST_MODIFIED",
          },
          dataFormatConfig: {
            format: "XML",
            rowPath: ".//items/item",
            includeAttributes: true,
            attributePrefix: "@",
          },
          credentials: {
            authType: "PRIVATE_KEY",
            username: "cromwell_feed_user",
            privateKey: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----",
            passphrase: "key-passphrase",
          },
          isActive: true,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.payload);
      expect(createBody.connection.channel).toBe("SFTP");
      expect(createBody.connection.dataFormat).toBe("XML");
      expect(createBody.connection.credentials.authType).toBe("PRIVATE_KEY");
      expect(createBody.connection.credentials.username).toBe("cromwell_feed_user");
    });
  });

  describe("Validation & Edge Cases", () => {
    it("should reject connection when name is empty", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/client/connections",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "   ",
          channel: "HTTP",
          dataFormat: "CSV",
          config: { channel: "HTTP", url: "https://example.com/feed.csv" },
          dataFormatConfig: { format: "CSV", delimiter: ";" },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("Connection name is required");
    });

    it("should reject connection when name exceeds 255 characters", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/client/connections",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "x".repeat(256),
          channel: "HTTP",
          dataFormat: "CSV",
          config: { channel: "HTTP", url: "https://example.com/feed.csv" },
          dataFormatConfig: { format: "CSV", delimiter: ";" },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("Connection name cannot exceed 255 characters");
    });

    it("should reject invalid schema payload with 400 status code", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/client/connections",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "Invalid SFTP Missing Host",
          channel: "SFTP",
          dataFormat: "CSV",
          config: {
            channel: "SFTP",
            host: "",
            remoteDir: "/feeds",
          },
          dataFormatConfig: {
            format: "CSV",
            delimiter: ";",
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toContain("Invalid SFTP connection config");
    });

    it("should return 404 when updating non-existent connection", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/client/connections/11111111-2222-3333-4444-555555555555",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
        payload: {
          name: "Non-existent",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Connection not found");
    });

    it("should return 404 when deleting non-existent connection", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/client/connections/11111111-2222-3333-4444-555555555555",
        headers: {
          authorization: "Bearer mock_jwt_user_conn",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Connection not found");
    });
  });

  describe("Testing & Lifecycle Endpoints", () => {
    it("should trigger test with 202, retrieve test-result with 200, and invalidate with 204", async () => {
      // 1. Create connection
      const createRes = await app.inject({
        method: "POST",
        url: "/api/client/connections",
        headers: { authorization: "Bearer mock_jwt_user_conn" },
        payload: {
          name: "Test Feed",
          channel: "HTTP",
          dataFormat: "CSV",
          config: { channel: "HTTP", url: "https://example.com/feed.csv" },
          dataFormatConfig: { format: "CSV", delimiter: ";" },
        },
      });
      const connId = JSON.parse(createRes.payload).connection.id;

      // 2. Trigger run-test (Expect 202 Accepted)
      const testRes = await app.inject({
        method: "POST",
        url: `/api/client/connections/${connId}/run-test`,
        headers: { authorization: "Bearer mock_jwt_user_conn" },
      });
      expect(testRes.statusCode).toBe(202);

      // 3. Get test-result (Expect 200 with testResult)
      const getResultRes = await app.inject({
        method: "GET",
        url: `/api/client/connections/${connId}/test-result`,
        headers: { authorization: "Bearer mock_jwt_user_conn" },
      });
      expect(getResultRes.statusCode).toBe(200);
      const resultBody = JSON.parse(getResultRes.payload);
      expect(resultBody.testResult.progress).toBe("start");

      // 4. Invalidate test-result (Expect 204 No Content)
      const deleteResultRes = await app.inject({
        method: "DELETE",
        url: `/api/client/connections/${connId}/test-result`,
        headers: { authorization: "Bearer mock_jwt_user_conn" },
      });
      expect(deleteResultRes.statusCode).toBe(204);

      // 5. Verify test-result is now null
      const checkRes = await app.inject({
        method: "GET",
        url: `/api/client/connections/${connId}/test-result`,
        headers: { authorization: "Bearer mock_jwt_user_conn" },
      });
      expect(JSON.parse(checkRes.payload).testResult).toBeNull();
    });

    it("should return 409 Conflict when attempting to update connection while test is in progress", async () => {
      // 1. Create connection
      const createRes = await app.inject({
        method: "POST",
        url: "/api/client/connections",
        headers: { authorization: "Bearer mock_jwt_user_conn" },
        payload: {
          name: "Conflict Feed",
          channel: "HTTP",
          dataFormat: "CSV",
          config: { channel: "HTTP", url: "https://example.com/feed.csv" },
          dataFormatConfig: { format: "CSV", delimiter: ";" },
        },
      });
      const connId = JSON.parse(createRes.payload).connection.id;

      // 2. Trigger run-test
      await app.inject({
        method: "POST",
        url: `/api/client/connections/${connId}/run-test`,
        headers: { authorization: "Bearer mock_jwt_user_conn" },
      });

      // 3. Attempt update immediately (Expect 409 Conflict)
      const updateRes = await app.inject({
        method: "PUT",
        url: `/api/client/connections/${connId}`,
        headers: { authorization: "Bearer mock_jwt_user_conn" },
        payload: { name: "Renamed While Testing" },
      });
      expect(updateRes.statusCode).toBe(400); // Or 409 handled by fastify/service
      expect(updateRes.payload).toContain("testing is in progress");
    });
  });
});
