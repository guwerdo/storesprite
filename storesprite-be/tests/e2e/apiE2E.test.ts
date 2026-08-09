import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { User } from "../../src/entities/User.js";

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
      await em.nativeDelete(User, {});
      await em.flush();
    }
  });

  afterAll(async () => {
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
});
