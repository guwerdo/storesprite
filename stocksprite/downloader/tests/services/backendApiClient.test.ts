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
      workerToken: "test_token",
      backendUrl: "http://backend:3000",
      outputDir: "/temp",
    };
    client = new BackendApiClient(config, loggerMock);
  });

  it("should fetch user connections with x-worker-token header", async () => {
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
      "http://backend:3000/api/worker/users/user_test/connections",
      expect.objectContaining({
        headers: { "x-worker-token": "test_token" },
      })
    );
  });

  it("should throw formatted error when request fails", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network Error"));

    await expect(client.getUserConnections("user_test")).rejects.toThrow("Failed to fetch user connections");
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
