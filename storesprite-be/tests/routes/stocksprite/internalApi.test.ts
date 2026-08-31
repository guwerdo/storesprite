import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("../../../src/plugins/mikroOrm.js", () => ({
  default: Object.assign(async () => {}, { [Symbol.for("fastify.display-name")]: "mikroOrmPlugin" }),
}));

import { buildApp } from "../../../src/app.js";
import { TYPES, IUserService, IDataConnectionService, User } from "../../../src/di/index.js";

describe("Internal API Unit Tests (Mocked Dependencies)", () => {
  let app: any;

  const mockUserService: IUserService = {
    getUserById: vi.fn(),
    createUser: vi.fn(),
  };

  const mockConnectionService: IDataConnectionService = {
    getConnections: vi.fn(),
    getConnectionById: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
  };

  beforeAll(async () => {
    process.env.INTERNAL_TOKEN = "mock_internal_token";
    app = buildApp({ logger: false });
    await app.ready();
    app.container.rebind(TYPES.IUserService).toConstantValue(mockUserService);
    app.container.rebind(TYPES.IDataConnectionService).toConstantValue(mockConnectionService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 403 when x-internal-token is missing or invalid", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/internal/stocksprite/connections/conn_123",
      headers: {
        "x-internal-token": "wrong_token",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toEqual({
      error: "Forbidden: Invalid internal token",
    });
  });

  it("should return 404 when GET /api/internal/stocksprite/users/:userId/connections is called for non-existent user", async () => {
    (mockUserService.getUserById as any).mockResolvedValue(null);

    const response = await app.inject({
      method: "GET",
      url: "/api/internal/stocksprite/users/non_existent_user/connections",
      headers: {
        "x-internal-token": "mock_internal_token",
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe("User 'non_existent_user' not found");
  });

  it("should return user connections when GET /api/internal/stocksprite/users/:userId/connections is called with valid internal token and existing user", async () => {
    (mockUserService.getUserById as any).mockResolvedValue(new User("user_mock", "test@example.com", "John Doe"));

    const mockConnections = [
      {
        id: "conn_1",
        name: "Cromwell",
        channel: "SFTP",
        dataFormat: "CSV",
        isActive: true,
        config: { channel: "SFTP", host: "sftp.cromwell.co.uk", remoteDir: "/" },
        dataFormatConfig: { format: "CSV", delimiter: "," },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (mockConnectionService.getConnections as any).mockResolvedValue(mockConnections);

    const response = await app.inject({
      method: "GET",
      url: "/api/internal/stocksprite/users/user_mock/connections",
      headers: {
        "x-internal-token": "mock_internal_token",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.connections).toEqual(mockConnections);
    expect(mockConnectionService.getConnections).toHaveBeenCalledWith("user_mock");
  });

  it("should return single connection when GET /api/internal/stocksprite/connections/:id is called", async () => {
    const mockConn = {
      id: "conn_123",
      name: "Feed Conn",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: false,
      config: { channel: "HTTP", url: "https://example.com/data.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockConnectionService.getConnectionByIdForWorker as any) = vi.fn().mockResolvedValue(mockConn);

    const response = await app.inject({
      method: "GET",
      url: "/api/internal/stocksprite/connections/conn_123",
      headers: {
        "x-internal-token": "mock_internal_token",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.connection).toEqual(mockConn);
  });

  it("should save test result when PATCH /api/internal/stocksprite/connections/:id/test-result is called", async () => {
    const mockUpdated = {
      id: "conn_123",
      name: "Feed Conn",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: false,
      config: { channel: "HTTP", url: "https://example.com/data.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      testResult: {
        progress: "finish",
        success: true,
        rowCount: 100,
        columnCount: 5,
        fileSize: 2048,
        columns: ["sku", "title", "price"],
        rows: [["1", "Item 1", "10"]],
        finished_at: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockConnectionService.saveTestResult as any) = vi.fn().mockResolvedValue(mockUpdated);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/internal/stocksprite/connections/conn_123/test-result",
      headers: {
        "x-internal-token": "mock_internal_token",
      },
      payload: {
        progress: "finish",
        success: true,
        rowCount: 100,
        columnCount: 5,
        fileSize: 2048,
        columns: ["sku", "title", "price"],
        rows: [["1", "Item 1", "10"]],
        finished_at: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(204);
  });
});
