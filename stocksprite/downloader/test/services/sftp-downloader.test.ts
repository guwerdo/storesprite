import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import SftpClient from "ssh2-sftp-client";
import { SftpDownloader } from "../../src/services/sftp-downloader.js";
import { DataConnectionDto } from "../../src/types/connection.types.js";

vi.mock("ssh2-sftp-client", () => ({ default: vi.fn() }));

describe("SftpDownloader Unit Tests", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let downloader: SftpDownloader;
  const testDir = path.join(os.tmpdir(), "sftp-downloader-tests-" + Date.now());

  beforeEach(() => {
    loggerMock = mock<Logger>();
    downloader = new SftpDownloader(loggerMock);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should connect, find latest file by alphabetical strategy, and download via fastGet", async () => {
    const destFile = path.join(testDir, "cromwell.raw.csv");

    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([
        { name: "feed_20260101.csv", type: "-", size: 100, modifyTime: 1000 },
        { name: "feed_20260102.csv", type: "-", size: 150, modifyTime: 2000 },
      ]),
      fastGet: vi.fn().mockImplementation(async (_remotePath: string, localPath: string) => {
        fs.writeFileSync(localPath, "part,free_stock_hu\n123,5\n");
      }),
      end: vi.fn().mockResolvedValue(true),
    };

    (SftpClient as unknown as vi.Mock).mockImplementation(function () {
      return mockSftpInstance;
    });

    const connection: DataConnectionDto = {
      id: "conn_sftp",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: {
        channel: "SFTP",
        host: "sftp.cromwell.co.uk",
        remoteDir: "/feeds",
        fileSelectionStrategy: "LATEST_ALPHABETICAL",
      },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await downloader.download(connection, destFile);

    expect(mockSftpInstance.connect).toHaveBeenCalled();
    expect(mockSftpInstance.fastGet).toHaveBeenCalledWith("/feeds/feed_20260102.csv", `${destFile}.tmp`);
    expect(result.destinationPath).toBe(destFile);
    expect(fs.existsSync(destFile)).toBe(true);
    expect(mockSftpInstance.end).toHaveBeenCalled();
  });

  it("should select the most recently modified file for LATEST_MODIFIED strategy", async () => {
    const destFile = path.join(testDir, "latest.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([
        { name: "a.csv", type: "-", size: 100, modifyTime: 1000 },
        { name: "b.csv", type: "-", size: 100, modifyTime: 3000 },
      ]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "sku;stock\n1;2\n");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(function () {
      return mockSftpInstance;
    });

    const connection: DataConnectionDto = {
      id: "conn_sftp_mod",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds", fileSelectionStrategy: "LATEST_MODIFIED" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);
    expect(mockSftpInstance.fastGet).toHaveBeenCalledWith("/feeds/b.csv", `${destFile}.tmp`);
  });

  it("should throw when the remote directory has no files", async () => {
    const destFile = path.join(testDir, "empty.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([]),
      fastGet: vi.fn(),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(function () {
      return mockSftpInstance;
    });

    const connection: DataConnectionDto = {
      id: "conn_sftp_none",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/empty" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(downloader.download(connection, destFile)).rejects.toThrow("No files found on SFTP server");
  });

  it("should reject an empty (0-byte) downloaded file", async () => {
    const destFile = path.join(testDir, "zero.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([{ name: "empty.csv", type: "-", size: 0, modifyTime: 1 }]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(function () {
      return mockSftpInstance;
    });

    const connection: DataConnectionDto = {
      id: "conn_sftp_zero",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(downloader.download(connection, destFile)).rejects.toThrow("received empty file (0 bytes)");
  });

  it("should use password auth when credentials.authType is PASSWORD", async () => {
    const destFile = path.join(testDir, "pw.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([{ name: "f.csv", type: "-", size: 1, modifyTime: 1 }]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "x");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(function () {
      return mockSftpInstance;
    });

    const connection: DataConnectionDto = {
      id: "conn_sftp_pw",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds" },
      credentials: { authType: "PASSWORD", username: "user", password: "secret" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);
    expect(mockSftpInstance.connect).toHaveBeenCalledWith(
      expect.objectContaining({ username: "user", password: "secret" })
    );
  });

  it("should use the private key raw string for PRIVATE_KEY auth when it is not a file path", async () => {
    const destFile = path.join(testDir, "key.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([{ name: "f.csv", type: "-", size: 1, modifyTime: 1 }]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "x");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(function () {
      return mockSftpInstance;
    });

    const connection: DataConnectionDto = {
      id: "conn_sftp_key",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds" },
      credentials: { authType: "PRIVATE_KEY", username: "user", privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);
    expect(mockSftpInstance.connect).toHaveBeenCalledWith(
      expect.objectContaining({ privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" })
    );
  });
});
