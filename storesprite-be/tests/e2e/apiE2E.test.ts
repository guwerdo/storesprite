import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/entities/User.js";
import { DataConnection } from "../../src/entities/DataConnection.js";

describe("E2E API Tests (Isolated Test Database)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Ensure test schema is created in test database
    if (app.orm) {
      const generator = app.orm.getSchemaGenerator();
      await generator.updateSchema();
    }
  });

  beforeEach(async () => {
    // Truncate test database tables before each test to guarantee fresh isolation
    if (app.orm) {
      const em = app.orm.em.fork();
      await em.nativeDelete(DataConnection, {});
      await em.nativeDelete(User, {});
      await em.flush();
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

  describe("POST /api/worker/users", () => {
    it("should return 403 when x-worker-token is invalid", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/worker/users",
        headers: {
          "x-worker-token": "wrong_token",
        },
        payload: {
          id: "test_id",
          email: "test@example.com",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should persist user in PostgreSQL test database and return 201", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/worker/users",
        headers: {
          "x-worker-token": "mock_worker_token",
        },
        payload: {
          id: "e2e_user_1",
          email: "e2e@example.com",
          name: "E2E User",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.user).toMatchObject({
        id: "e2e_user_1",
        email: "e2e@example.com",
        name: "E2E User",
      });

      // Verify directly in test database via MikroORM
      const em = app.orm.em.fork();
      const savedUser = await em.findOne(User, { id: "e2e_user_1" });
      expect(savedUser).not.toBeNull();
      expect(savedUser?.email).toBe("e2e@example.com");
    });
  });

  describe("GET /api/worker/users/:userId/connections", () => {
    it("should return 403 when x-worker-token is invalid", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/worker/users/test_user_id/connections",
        headers: {
          "x-worker-token": "wrong_token",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Forbidden: Invalid worker token");
    });

    it("should fetch user connections from database via worker API with valid x-worker-token", async () => {
      const em = app.orm.em.fork();

      // Seed user
      const user = new User("worker_e2e_user", "worker_e2e@test.com", "Worker E2E");
      await em.persistAndFlush(user);

      // Seed connection
      const connection = new DataConnection(
        user,
        "Cromwell SFTP",
        "SFTP",
        "CSV",
        { channel: "SFTP", host: "sftp.cromwell.co.uk", remoteDir: "/feeds" },
        { format: "CSV", delimiter: "," },
        true,
        { authType: "PASSWORD", username: "user1", password: "pwd" }
      );
      await em.persistAndFlush(connection);

      const response = await app.inject({
        method: "GET",
        url: `/api/worker/users/${user.id}/connections`,
        headers: {
          "x-worker-token": "mock_worker_token",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.connections).toHaveLength(1);
      expect(body.connections[0]).toMatchObject({
        id: connection.id,
        name: "Cromwell SFTP",
        channel: "SFTP",
        dataFormat: "CSV",
        isActive: true,
      });
    });
  });
});
