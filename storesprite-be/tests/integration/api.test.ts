import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/entities/user/User.js";
import { DataConnection } from "../../src/entities/stocksprite/DataConnection.js";
import { resetTestDatabase } from "../helpers/testDatabase.js";

describe("API Integration Tests (Isolated Test Database)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    await resetTestDatabase(app);
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

  describe("GET /api/internal/stocksprite/users/:userId/connections", () => {
    it("should return 403 when x-internal-token is invalid", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/internal/stocksprite/users/test_user_id/connections",
        headers: {
          "x-internal-token": "wrong_token",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Forbidden: Invalid internal token");
    });

    it("should fetch user connections from database via internal API with valid x-internal-token", async () => {
      const em = app.orm.em.fork();

      // Seed user
      const user = new User("worker_api_user", "worker_api@test.com", "Worker API");
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
        url: `/api/internal/stocksprite/users/${user.id}/connections`,
        headers: {
          "x-internal-token": "mock_internal_token",
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
