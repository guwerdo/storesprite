import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { HttpDownloader } from "../../src/services/HttpDownloader.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";

vi.mock("axios");

describe("HttpDownloader Unit Tests", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let downloader: HttpDownloader;
  const testDir = path.join(os.tmpdir(), "http-downloader-tests-" + Date.now());

  beforeEach(() => {
    loggerMock = mock<Logger>();
    downloader = new HttpDownloader(loggerMock);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should stream and download valid CSV data to destination path", async () => {
    const destFile = path.join(testDir, "test.raw.csv");
    const mockContent = "sku;stock;price\nABC;10;99.9\n";

    const readable = Readable.from([Buffer.from(mockContent)]);
    vi.mocked(axios).mockResolvedValueOnce({
      data: readable,
      status: 200,
    });

    const connection: DataConnectionDto = {
      id: "conn_http",
      name: "Magictools",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/products.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await downloader.download(connection, destFile);

    expect(result.destinationPath).toBe(destFile);
    expect(result.byteCount).toBe(Buffer.byteLength(mockContent));
    expect(fs.existsSync(destFile)).toBe(true);
    expect(fs.readFileSync(destFile, "utf-8")).toBe(mockContent);
  });

  it("should reject and abort when response is an HTML error/login page", async () => {
    const destFile = path.join(testDir, "test.raw.csv");
    const htmlContent = "<!DOCTYPE html><html><body>Error 404</body></html>";

    const readable = Readable.from([Buffer.from(htmlContent)]);
    vi.mocked(axios).mockResolvedValueOnce({
      data: readable,
      status: 200,
    });

    const connection: DataConnectionDto = {
      id: "conn_http",
      name: "Magictools",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/products.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(downloader.download(connection, destFile)).rejects.toThrow("HTML web page instead of CSV/XML data");
  });

  it("should reject and abort when response is empty (0 bytes)", async () => {
    const destFile = path.join(testDir, "empty.raw.csv");
    const readable = Readable.from([]);
    vi.mocked(axios).mockResolvedValueOnce({
      data: readable,
      status: 200,
    });

    const connection: DataConnectionDto = {
      id: "conn_http",
      name: "EmptyFeed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/empty.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(downloader.download(connection, destFile)).rejects.toThrow("received empty response (0 bytes)");
  });
});
