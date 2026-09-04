import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { BackendApiClient } from "../../src/services/backend-api-client.js";
import { AppConfig } from "../../src/config/app.config.js";
import { DataConnectionDto } from "../../src/types/connection.types.js";

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

  it("should report a mapping run error via POST with the internal token", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ status: 200 });

    await client.reportRunError("map_1", "run_1", "boom");

    expect(axios.post).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/mappings/map_1/progress",
      { runId: "run_1", progress: "error", error: "boom" },
      expect.objectContaining({ headers: { "x-internal-token": "test_token" } })
    );
  });

  it("should throw a formatted error when reporting a mapping run error fails", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("net down"));

    await expect(client.reportRunError("map_1", "run_1", "boom")).rejects.toThrow(
      "Failed to report run error for mapping 'map_1'"
    );
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
