import "reflect-metadata";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { DownloaderService } from "../../src/services/downloader-service.js";
import { DownloaderFactory } from "../../src/services/downloader-factory.js";
import { ConverterFactory } from "../../src/services/converter-factory.js";
import { AppConfig } from "../../src/config/app.config.js";
import { IBackendApiClient } from "../../src/types/backend-api-client.interface.js";
import { IDownloader } from "../../src/types/downloader.interface.js";
import { IDataConverter } from "../../src/types/data-converter.interface.js";
import { DataConnectionDto } from "../../src/types/connection.types.js";

describe("DownloaderService Unit Tests", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let apiClientMock: ReturnType<typeof mock<IBackendApiClient>>;
  let downloaderFactory: DownloaderFactory;
  let converterFactory: ConverterFactory;
  let downloaderMock: ReturnType<typeof mock<IDownloader>>;
  let converterMock: ReturnType<typeof mock<IDataConverter>>;
  let config: AppConfig;
  let service: DownloaderService;
  const testDir = path.join(os.tmpdir(), "downloader-service-tests-" + Date.now());

  beforeEach(() => {
    loggerMock = mock<Logger>();
    apiClientMock = mock<IBackendApiClient>();
    downloaderMock = mock<IDownloader>();
    converterMock = mock<IDataConverter>();

    // Real factories: HTTP+SFTP route to downloaderMock, CSV+XML to converterMock.
    // Connections with an unsupported channel/format now throw for real.
    downloaderFactory = new DownloaderFactory(downloaderMock, downloaderMock);
    converterFactory = new ConverterFactory(converterMock, converterMock);

    config = {
      userId: "user_mock",
      internalToken: "token_123",
      backendUrl: "http://backend:3000",
      outputDir: testDir,
    };

    service = new DownloaderService(config, loggerMock, apiClientMock, downloaderFactory, converterFactory);

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

  it("should execute test mode, stream CSV sample rows and report stage progress and results", async () => {
    config.testConnectionId = "test_conn_123";

    const mockConn: DataConnectionDto = {
      id: "test_conn_123",
      name: "Supplier Feed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: false,
      config: { channel: "HTTP", url: "https://example.com/feed.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    apiClientMock.getConnectionById.mockResolvedValue(mockConn);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "test_test_conn_123.raw.csv"),
      isUnchanged: false,
      byteCount: 1000,
    });

    converterMock.convert.mockImplementation(async (_conn, _raw, csvPath) => {
      fs.writeFileSync(
        csvPath,
        "sku;title;price;stock\n101;Drill 10mm;19.99;50\n102;Hammer 500g;9.99;20\n103;Wrench 12mm;14.50;10\n104;Saw 300mm;25.00;5\n",
        "utf-8"
      );
      return {
        outputPath: csvPath,
        rowCount: 4,
        byteCount: 100,
      };
    });

    const summary = await service.run();

    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(0);

    // Verify stage progress calls
    expect(apiClientMock.reportTestResult).toHaveBeenCalledWith("test_conn_123", {
      progress: "download",
    });
    expect(apiClientMock.reportTestResult).toHaveBeenCalledWith("test_conn_123", {
      progress: "convert",
    });

    // Verify final finish result call
    expect(apiClientMock.reportTestResult).toHaveBeenCalledWith(
      "test_conn_123",
      expect.objectContaining({
        progress: "finish",
        success: true,
        rowCount: 4,
        columnCount: 4,
        columns: ["sku", "title", "price", "stock"],
        rows: [
          ["101", "Drill 10mm", "19.99", "50"],
          ["102", "Hammer 500g", "9.99", "20"],
          ["103", "Wrench 12mm", "14.50", "10"],
        ],
      })
    );
  });

  it("should report test failure when download throws error during test mode", async () => {
    config.testConnectionId = "failing_conn_999";

    const mockConn: DataConnectionDto = {
      id: "failing_conn_999",
      name: "Broken Feed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: false,
      config: { channel: "HTTP", url: "https://example.com/bad.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    apiClientMock.getConnectionById.mockResolvedValue(mockConn);
    downloaderMock.download.mockRejectedValue(new Error("SFTP authentication failed"));

    const summary = await service.run();

    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);

    expect(apiClientMock.reportTestResult).toHaveBeenCalledWith(
      "failing_conn_999",
      expect.objectContaining({
        progress: "finish",
        success: false,
        errorMessage: expect.stringContaining("SFTP authentication failed"),
      })
    );
  });

  it("should keep a quoted cell containing a semicolon as a single preview column", async () => {
    config.testConnectionId = "test_conn_semicolon";

    const mockConn: DataConnectionDto = {
      id: "test_conn_semicolon",
      name: "Semicolon Feed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: false,
      config: { channel: "HTTP", url: "https://example.com/feed.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    apiClientMock.getConnectionById.mockResolvedValue(mockConn);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "test_test_conn_semicolon.raw.csv"),
      isUnchanged: false,
      byteCount: 1000,
    });

    converterMock.convert.mockImplementation(async (_conn, _raw, csvPath) => {
      fs.writeFileSync(
        csvPath,
        'sku;description;stock\n"SKU;001";Drill;50\n"SKU;002";Hammer;20\n',
        "utf-8"
      );
      return { outputPath: csvPath, rowCount: 2, byteCount: 100 };
    });

    await service.run();

    expect(apiClientMock.reportTestResult).toHaveBeenCalledWith(
      "test_conn_semicolon",
      expect.objectContaining({
        progress: "finish",
        success: true,
        columnCount: 3,
        columns: ["sku", "description", "stock"],
        rows: [
          ["SKU;001", "Drill", "50"],
          ["SKU;002", "Hammer", "20"],
        ],
      })
    );
  });

  it("should record an error and continue when a connection uses an unsupported channel", async () => {
    const goodConnection: DataConnectionDto = {
      id: "good_1",
      name: "Good Feed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/good.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ftpConnection = {
      id: "ftp_1",
      name: "FTP Feed",
      channel: "FTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "FTP" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as DataConnectionDto;

    apiClientMock.getUserConnections.mockResolvedValue([goodConnection, ftpConnection]);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "good_1.raw.csv"),
      isUnchanged: false,
      byteCount: 10,
    });
    converterMock.convert.mockResolvedValue({
      outputPath: path.join(testDir, "good_1.csv"),
      rowCount: 1,
      byteCount: 4,
    });

    const summary = await service.run();

    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    const ftpResult = summary.results.find((r) => r.connectionId === "ftp_1");
    expect(ftpResult?.status).toBe("ERROR");
    expect(ftpResult?.error).toContain("Unsupported download channel: 'FTP'");
    // The earlier good connection was still processed, so the loop continued.
    expect(summary.results.find((r) => r.connectionId === "good_1")?.status).toBe("OK");
  });

  it("should record an error when a connection uses an unsupported data format", async () => {
    const jsonConnection = {
      id: "json_1",
      name: "JSON Feed",
      channel: "HTTP",
      dataFormat: "JSON",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/f.json" },
      dataFormatConfig: { format: "JSON" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as DataConnectionDto;

    apiClientMock.getUserConnections.mockResolvedValue([jsonConnection]);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "json_1.raw.json"),
      isUnchanged: false,
      byteCount: 9,
    });

    const summary = await service.run();

    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("Unsupported data format: 'JSON'");
  });

  it("should report a test failure when the connection channel is unsupported", async () => {
    config.testConnectionId = "ftp_test";

    const ftpConnection = {
      id: "ftp_test",
      name: "FTP Feed",
      channel: "FTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "FTP" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as DataConnectionDto;

    apiClientMock.getConnectionById.mockResolvedValue(ftpConnection);

    const summary = await service.run();

    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(apiClientMock.reportTestResult).toHaveBeenCalledWith(
      "ftp_test",
      expect.objectContaining({
        progress: "finish",
        success: false,
        errorMessage: expect.stringContaining("Unsupported download channel: 'FTP'"),
      })
    );
  });
});
