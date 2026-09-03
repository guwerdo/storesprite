import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { BackendApiClient } from "../../src/services/BackendApiClient.js";
import { AppConfig } from "../../src/config/app.config.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";

vi.mock("axios");

describe("BackendApiClient Unit Tests", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let config: AppConfig;
  let client: BackendApiClient;

  beforeEach(() => {
    loggerMock = mock<Logger>();
    config = {
      userId: "user_test",
      internalToken: "test_token",
      backendUrl: "http://backend:3000",
      outputDir: "/temp",
    };
    client = new BackendApiClient(config, loggerMock);
  });

  it("should fetch user connections with x-internal-token header", async () => {
    const mockConnections: DataConnectionDto[] = [
      {
        id: "conn_1",
        name: "Cromwell",
        channel: "SFTP",
        dataFormat: "CSV",
        isActive: true,
        config: { channel: "SFTP", host: "sftp.test.com", remoteDir: "/" },
        dataFormatConfig: { format: "CSV", delimiter: "," },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { connections: mockConnections },
    });

    const result = await client.getUserConnections("user_test");

    expect(result).toEqual(mockConnections);
    expect(axios.get).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/users/user_test/connections",
      expect.objectContaining({
        headers: { "x-internal-token": "test_token" },
      })
    );
  });

  it("should throw formatted error when request fails", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network Error"));

    await expect(client.getUserConnections("user_test")).rejects.toThrow("Failed to fetch user connections");
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("should fetch a single connection by id with the internal token", async () => {
    const conn = {
      id: "conn_1",
      name: "X",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: {},
      dataFormatConfig: {},
      createdAt: "",
      updatedAt: "",
    } as DataConnectionDto;

    vi.mocked(axios.get).mockResolvedValueOnce({ data: { connection: conn } });

    const result = await client.getConnectionById("conn_1");

    expect(result).toEqual(conn);
    expect(axios.get).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/connections/conn_1",
      expect.objectContaining({ headers: { "x-internal-token": "test_token" } })
    );
  });

  it("should throw when a single connection is not found in the response", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

    await expect(client.getConnectionById("missing")).rejects.toThrow("not found in backend response");
  });

  it("should report a test result via PATCH with the internal token", async () => {
    vi.mocked(axios.patch).mockResolvedValueOnce({ status: 200 });

    await client.reportTestResult("conn_1", { progress: "finish" });

    expect(axios.patch).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/connections/conn_1/test-result",
      { progress: "finish" },
      expect.objectContaining({ headers: { "x-internal-token": "test_token" } })
    );
  });

  it("should throw a formatted error when reporting a test result fails", async () => {
    vi.mocked(axios.patch).mockRejectedValueOnce(new Error("net down"));

    await expect(client.reportTestResult("conn_1", { progress: "finish" })).rejects.toThrow(
      "Failed to report test result for 'conn_1'"
    );
  });
});
