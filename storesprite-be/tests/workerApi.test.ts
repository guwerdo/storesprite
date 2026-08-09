import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { TYPES, IUserService, User } from "../src/di/index.js";

describe("Worker API Unit Tests (Mocked Dependencies)", () => {
  let app: any;

  const mockUserService: IUserService = {
    getUserById: vi.fn(),
    createUser: vi.fn(),
  };

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    app.container.rebind(TYPES.IUserService).toConstantValue(mockUserService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 403 when x-worker-token is missing or invalid", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/worker/users",
      headers: {
        "x-worker-token": "wrong_token",
      },
      payload: {
        id: "123",
        email: "test@example.com",
        name: "Test User",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toEqual({
      error: "Forbidden: Invalid worker token",
    });
  });

  it("should return 201 and invoke IUserService.createUser when x-worker-token is correct", async () => {
    (mockUserService.createUser as any).mockResolvedValue(new User("user_mock", "test@example.com", "John Doe"));

    const response = await app.inject({
      method: "POST",
      url: "/api/worker/users",
      headers: {
        "x-worker-token": "mock_worker_token",
      },
      payload: {
        id: "user_mock",
        email: "test@example.com",
        name: "John Doe",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.user).toMatchObject({
      id: "user_mock",
      email: "test@example.com",
      name: "John Doe",
    });
    expect(mockUserService.createUser).toHaveBeenCalledWith("user_mock", "test@example.com", "John Doe");
  });
});
