import fs from "node:fs";
import path from "node:path";
import { injectable, inject } from "inversify";
import SftpClient from "ssh2-sftp-client";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { IDownloader, DownloadResult } from "../types/Downloader.interface.js";
import {
  DataConnectionDto,
  SftpConnectionConfig,
  SftpCredentials,
} from "../types/Connection.types.js";
import { FileUtil } from "../utils/file-util.js";
import { StreamUtil } from "../utils/stream-util.js";
import { ErrorUtil } from "../utils/error-util.js";

@injectable()
export class SftpDownloader implements IDownloader {
  constructor(@inject(TYPES.Logger) private readonly _logger: Logger) {}

  public async download(connection: DataConnectionDto, destinationPath: string): Promise<DownloadResult> {
    const config = connection.config as SftpConnectionConfig;
    const credentials = connection.credentials as SftpCredentials | null;

    this._logger.info("Starting SFTP download", {
      connectionId: connection.id,
      name: connection.name,
      host: config.host,
      remoteDir: config.remoteDir,
    });

    const sftp = new SftpClient();
    const tempFilePath = `${destinationPath}.tmp`;
    FileUtil.ensureDirExists(path.dirname(destinationPath));

    try {
      const connectOptions: SftpClient.ConnectOptions = {
        host: config.host,
        port: config.port || 22,
        username: credentials?.username || "anonymous",
      };

      if (credentials) {
        if (credentials.authType === "PASSWORD") {
          connectOptions.password = credentials.password;
        } else if (credentials.authType === "PRIVATE_KEY") {
          // If privateKey is a file path, read it; otherwise treat as raw key string
          if (fs.existsSync(credentials.privateKey)) {
            connectOptions.privateKey = fs.readFileSync(credentials.privateKey, "utf-8");
          } else {
            connectOptions.privateKey = credentials.privateKey;
          }
          if (credentials.passphrase) {
            connectOptions.passphrase = credentials.passphrase;
          }
        }
      }

      await sftp.connect(connectOptions);

      const remoteDir = config.remoteDir || "/";
      const fileList = await sftp.list(remoteDir);
      const validFiles = fileList.filter((f) => !f.name.startsWith(".") && f.type === "-");

      if (validFiles.length === 0) {
        throw new Error(`No files found on SFTP server at '${remoteDir}'.`);
      }

      let selectedFile = validFiles[0];
      const strategy = config.fileSelectionStrategy || "LATEST_ALPHABETICAL";

      if (strategy === "LATEST_MODIFIED") {
        validFiles.sort((a, b) => b.modifyTime - a.modifyTime);
        selectedFile = validFiles[0];
      } else {
        // LATEST_ALPHABETICAL
        validFiles.sort((a, b) => a.name.localeCompare(b.name));
        selectedFile = validFiles[validFiles.length - 1];
      }

      const remoteFilePath = path.posix.join(remoteDir, selectedFile.name);
      this._logger.info("Selected remote SFTP file for download", {
        connectionId: connection.id,
        remoteFilePath,
        fileSize: selectedFile.size,
      });

      await sftp.fastGet(remoteFilePath, tempFilePath);

      const byteCount = FileUtil.getFileSize(tempFilePath);
      if (byteCount === 0) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        throw new Error(`SFTP download for '${connection.name}' received empty file (0 bytes).`);
      }

      let isUnchanged = false;
      if (fs.existsSync(destinationPath)) {
        isUnchanged = await StreamUtil.compareFileHash(destinationPath, tempFilePath);
      }

      if (isUnchanged) {
        this._logger.info("SFTP downloaded content is identical to existing file on disk (unchanged)", {
          connectionId: connection.id,
          name: connection.name,
        });
      }

      if (fs.existsSync(destinationPath)) {
        fs.unlinkSync(destinationPath);
      }
      fs.renameSync(tempFilePath, destinationPath);

      this._logger.info("SFTP download completed successfully", {
        connectionId: connection.id,
        name: connection.name,
        destinationPath,
        byteCount,
        isUnchanged,
      });

      return {
        destinationPath,
        isUnchanged,
        byteCount,
      };
    } catch (error) {
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // Ignored
        }
      }
      const errorMsg = ErrorUtil.stringifyError(error);
      this._logger.error("SFTP download failed", {
        connectionId: connection.id,
        name: connection.name,
        error: errorMsg,
      });
      throw error;
    } finally {
      await sftp.end().catch((_: unknown) => {
        // Ignored close error
      });
    }
  }
}
