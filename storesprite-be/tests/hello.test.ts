import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";

describe("Public API Hello Endpoint", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return { greetings: 'hello' } on GET /api/client/hello", async () => {
    // Arrange & Act
    const response = await app.inject({
      method: "GET",
      url: "/api/client/hello",
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      greetings: "hello",
    });
  });
});
