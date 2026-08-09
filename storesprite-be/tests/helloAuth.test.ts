import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

describe("Client API Hello Auth Endpoint", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 when Authorization header is missing on GET /api/client/hello-auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/client/hello-auth",
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.payload)).toEqual({
      error: "Unauthorized: Missing Bearer Token",
    });
  });
});
