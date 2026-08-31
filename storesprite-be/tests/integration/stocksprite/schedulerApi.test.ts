import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../../src/app.js";
import { resetTestDatabase } from "../helpers/testDatabase.js";

describe("Scheduler API integration tests", () => {
  let app: ReturnType<typeof buildApp>;
  const token = "scheduler_test_token";

  beforeAll(async () => {
    process.env.INTERNAL_TOKEN = token;
    app = buildApp({ logger: false });
    await app.ready();
    await resetTestDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("403 without valid internal token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/internal/stocksprite/scheduler/run",
      headers: { "x-internal-token": "wrong" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("200 with valid token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/internal/stocksprite/scheduler/run",
      headers: { "x-internal-token": token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.dispatched)).toBe(true);
  });
});
