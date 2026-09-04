import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import { injectable, inject } from "inversify";
import axios, { AxiosRequestConfig } from "axios";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { IDownloader, DownloadResult } from "../types/downloader.interface.js";
import {
  DataConnectionDto,
  HttpConnectionConfig,
  HttpCredentials,
} from "../types/connection.types.js";
import { FileUtil } from "../utils/file-util.js";
import { StreamUtil } from "../utils/stream-util.js";
import { ErrorUtil } from "../utils/error-util.js";

@injectable()
export class HttpDownloader implements IDownloader {
  constructor(@inject(TYPES.Logger) private readonly _logger: Logger) {}

  public async download(connection: DataConnectionDto, destinationPath: string): Promise<DownloadResult> {
    const config = connection.config as HttpConnectionConfig;
    const credentials = connection.credentials as HttpCredentials | null;

    this._logger.info("Starting HTTP download", {
      url: config.url,
    });

    const requestConfig: AxiosRequestConfig = {
      method: config.method || "GET",
      url: config.url,
      responseType: "stream",
      timeout: (config.timeoutSeconds || 60) * 1000,
      validateStatus: (status) => status >= 200 && status < 300,
    };

    if (config.insecureIgnoreSsl) {
      requestConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      requestConfig.httpAgent = new http.Agent();
    }

    // Apply credentials
    if (credentials) {
      requestConfig.headers = requestConfig.headers || {};
      switch (credentials.authType) {
        case "BASIC":
          requestConfig.auth = {
            username: credentials.username,
            password: credentials.password,
          };
          break;
        case "BEARER":
          requestConfig.headers["Authorization"] = `Bearer ${credentials.token}`;
          break;
        case "API_KEY":
          if (credentials.headerName && credentials.headerValue) {
            requestConfig.headers[credentials.headerName] = credentials.headerValue;
          }
          break;
        default:
          break;
      }
    }

    const tempFilePath = `${destinationPath}.tmp`;
    FileUtil.ensureDirForFile(destinationPath);

    try {
      const response = await axios(requestConfig);
      const stream = response.data as NodeJS.ReadableStream;

      let firstChunkChecked = false;
      let totalBytes = 0;

      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempFilePath);

        stream.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (!firstChunkChecked) {
            firstChunkChecked = true;
            if (FileUtil.isHtmlContent(chunk)) {
              writeStream.destroy();
              reject(
                new Error(
                  `HTTP response for connection '${connection.id}' returned an HTML web page instead of CSV/XML data.`
                )
              );
              return;
            }
          }
        });

        stream.on("error", (err) => {
          writeStream.destroy();
          reject(err instanceof Error ? err : new Error(String(err)));
        });

        writeStream.on("error", (err) => {
          reject(err instanceof Error ? err : new Error(String(err)));
        });

        writeStream.on("finish", () => {
          resolve();
        });

        stream.pipe(writeStream);
      });

      if (totalBytes === 0) {
        FileUtil.deleteFileIfExists(tempFilePath);
        throw new Error(`HTTP download for connection '${connection.id}' received empty response (0 bytes).`);
      }

      // Replace target destination with new file, reporting whether content is unchanged
      const isUnchanged = await StreamUtil.commitDownloadedFile(tempFilePath, destinationPath);

      if (isUnchanged) {
        this._logger.info("Downloaded content is identical to existing file on disk (unchanged)");
      }

      this._logger.info("HTTP download completed successfully", {
        destinationPath,
        byteCount: totalBytes,
        isUnchanged,
      });

      return {
        destinationPath,
        isUnchanged,
        byteCount: totalBytes,
      };
    } catch (error) {
      FileUtil.deleteFileIfExists(tempFilePath);
      const errorMsg = ErrorUtil.stringifyError(error);
      this._logger.error("HTTP download failed", {
        error: errorMsg,
      });
      throw error;
    }
  }
}
