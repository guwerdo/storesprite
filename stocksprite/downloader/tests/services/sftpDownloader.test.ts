import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import SftpClient from "ssh2-sftp-client";
import { SftpDownloader } from "../../src/services/SftpDownloader.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";

vi.mock("ssh2-sftp-client");

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

    (SftpClient as unknown as vi.Mock).mockImplementation(() => mockSftpInstance);

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
});
