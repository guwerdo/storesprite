import "reflect-metadata";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { DownloaderService } from "../../src/services/DownloaderService.js";
import { AppConfig } from "../../src/config/app.config.js";
import { IBackendApiClient } from "../../src/types/BackendApiClient.interface.js";
import { IDownloaderFactory, IDownloader } from "../../src/types/Downloader.interface.js";
import { IConverterFactory, IDataConverter } from "../../src/types/DataConverter.interface.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";

describe("DownloaderService Unit Tests", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let apiClientMock: ReturnType<typeof mock<IBackendApiClient>>;
  let downloaderFactoryMock: ReturnType<typeof mock<IDownloaderFactory>>;
  let converterFactoryMock: ReturnType<typeof mock<IConverterFactory>>;
  let downloaderMock: ReturnType<typeof mock<IDownloader>>;
  let converterMock: ReturnType<typeof mock<IDataConverter>>;
  let config: AppConfig;
  let service: DownloaderService;
  const testDir = path.join(os.tmpdir(), "downloader-service-tests-" + Date.now());

  beforeEach(() => {
    loggerMock = mock<Logger>();
    apiClientMock = mock<IBackendApiClient>();
    downloaderFactoryMock = mock<IDownloaderFactory>();
    converterFactoryMock = mock<IConverterFactory>();
    downloaderMock = mock<IDownloader>();
    converterMock = mock<IDataConverter>();

    downloaderFactoryMock.getDownloader.mockReturnValue(downloaderMock);
    converterFactoryMock.getConverter.mockReturnValue(converterMock);

    config = {
      userId: "user_mock",
      workerToken: "token_123",
      backendUrl: "http://backend:3000",
      outputDir: testDir,
    };

    service = new DownloaderService(
      config,
      loggerMock,
      apiClientMock,
      downloaderFactoryMock,
      converterFactoryMock
    );

    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should orchestrate download and conversion for active connections", async () => {
    const mockConnections: DataConnectionDto[] = [
      {
        id: "345",
        name: "Madalbal",
        channel: "HTTP",
        dataFormat: "XML",
        isActive: true,
        config: { channel: "HTTP", url: "https://example.com/madalbal.xml" },
        dataFormatConfig: { format: "XML", rowPath: "product" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "inactive_conn",
        name: "Old Supplier",
        channel: "HTTP",
        dataFormat: "CSV",
        isActive: false,
        config: { channel: "HTTP", url: "https://example.com/old.csv" },
        dataFormatConfig: { format: "CSV", delimiter: "," },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    apiClientMock.getUserConnections.mockResolvedValue(mockConnections);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "345.raw.xml"),
      isUnchanged: false,
      byteCount: 500,
    });
    converterMock.convert.mockResolvedValue({
      outputPath: path.join(testDir, "345.csv"),
      rowCount: 10,
      byteCount: 300,
    });

    const summary = await service.run();

    expect(summary.totalConnections).toBe(2);
    expect(summary.activeConnections).toBe(1);
    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(summary.results[0].connectionId).toBe("345");
    expect(summary.results[0].rawFilePath).toBe(path.join(testDir, "345.raw.xml"));
    expect(summary.results[0].csvFilePath).toBe(path.join(testDir, "345.csv"));
  });

  it("should record errors and continue when a connection download fails", async () => {
    const mockConnections: DataConnectionDto[] = [
      {
        id: "2",
        name: "Broken Feed",
        channel: "HTTP",
        dataFormat: "CSV",
        isActive: true,
        config: { channel: "HTTP", url: "https://example.com/broken.csv" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    apiClientMock.getUserConnections.mockResolvedValue(mockConnections);
    downloaderMock.download.mockRejectedValue(new Error("Connection timed out"));

    const summary = await service.run();

    expect(summary.activeConnections).toBe(1);
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("Connection timed out");
  });
});
