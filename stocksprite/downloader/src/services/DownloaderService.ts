import fs from "node:fs";
import readline from "node:readline";
import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { AppConfig } from "../config/app.config.js";
import { IBackendApiClient } from "../types/BackendApiClient.interface.js";
import { IDownloaderFactory } from "../types/Downloader.interface.js";
import { IConverterFactory } from "../types/DataConverter.interface.js";
import {
  IDownloaderService,
  DownloaderExecutionSummary,
  ConnectionProcessResult,
} from "../types/DownloaderService.interface.js";
import { FileUtil } from "../utils/file-util.js";
import { ErrorUtil } from "../utils/error-util.js";

@injectable()
export class DownloaderService implements IDownloaderService {
  constructor(
    @inject(TYPES.AppConfig) private readonly _config: AppConfig,
    @inject(TYPES.Logger) private readonly _logger: Logger,
    @inject(TYPES.IBackendApiClient) private readonly _apiClient: IBackendApiClient,
    @inject(TYPES.IDownloaderFactory) private readonly _downloaderFactory: IDownloaderFactory,
    @inject(TYPES.IConverterFactory) private readonly _converterFactory: IConverterFactory
  ) {}

  public async run(): Promise<DownloaderExecutionSummary> {
    const { userId, outputDir, testConnectionId } = this._config;

    // Check if running in single connection test mode
    if (testConnectionId) {
      return this._runTestMode(testConnectionId);
    }

    this._logger.info("Starting Downloader session", {
      userId,
      outputDir,
      backendUrl: this._config.backendUrl,
    });

    FileUtil.ensureDirExists(outputDir);

    const allConnections = await this._apiClient.getUserConnections(userId);
    const activeConnections = allConnections.filter((c) => c.isActive);

    this._logger.info("Retrieved user data connections", {
      total: allConnections.length,
      active: activeConnections.length,
    });

    if (activeConnections.length === 0) {
      this._logger.warn(
        allConnections.length === 0
          ? `No data connections configured for user '${userId}'.`
          : `User '${userId}' has ${allConnections.length} connection(s), but none are active (isActive = false).`
      );
    }

    const results: ConnectionProcessResult[] = [];

    for (const connection of activeConnections) {
      this._logger.info(`--- Processing connection '${connection.name}' [ID: ${connection.id}] ---`, {
        connectionId: connection.id,
        name: connection.name,
        channel: connection.channel,
        dataFormat: connection.dataFormat,
      });

      const rawFilePath = FileUtil.getRawFilePath(outputDir, connection.id, connection.dataFormat);
      const csvFilePath = FileUtil.getCsvFilePath(outputDir, connection.id);

      try {
        // Step 1: Download
        const downloader = this._downloaderFactory.getDownloader(connection.channel);
        const downloadResult = await downloader.download(connection, rawFilePath);

        // Step 2: Convert to Standardized CSV
        const converter = this._converterFactory.getConverter(connection.dataFormat);
        await converter.convert(connection, rawFilePath, csvFilePath);

        results.push({
          connectionId: connection.id,
          name: connection.name,
          channel: connection.channel,
          dataFormat: connection.dataFormat,
          status: "OK",
          isUnchanged: downloadResult.isUnchanged,
          rawFilePath,
          csvFilePath,
        });

        this._logger.info(`Successfully processed connection '${connection.name}' [ID: ${connection.id}]`, {
          connectionId: connection.id,
          csvFilePath,
          isUnchanged: downloadResult.isUnchanged,
        });
      } catch (error) {
        const errorMsg = ErrorUtil.stringifyError(error);
        this._logger.error(`Error processing connection '${connection.name}' [ID: ${connection.id}]`, {
          connectionId: connection.id,
          name: connection.name,
          error: errorMsg,
        });

        results.push({
          connectionId: connection.id,
          name: connection.name,
          channel: connection.channel,
          dataFormat: connection.dataFormat,
          status: "ERROR",
          error: errorMsg,
          rawFilePath,
          csvFilePath,
        });
      }
    }

    const successCount = results.filter((r) => r.status === "OK").length;
    const errorCount = results.filter((r) => r.status === "ERROR").length;

    const summary: DownloaderExecutionSummary = {
      userId,
      totalConnections: allConnections.length,
      activeConnections: activeConnections.length,
      successCount,
      errorCount,
      results,
    };

    const statusSummary = results.map((r) => `${r.name} (${r.connectionId}): ${r.status}`).join(", ");
    this._logger.info(`Downloader session completed. ${statusSummary}`, {
      userId,
      successCount,
      errorCount,
    });

    return summary;
  }

  private async _runTestMode(connectionId: string): Promise<DownloaderExecutionSummary> {
    const startTime = Date.now();
    const { userId, outputDir } = this._config;
    FileUtil.ensureDirExists(outputDir);

    this._logger.info("Executing single connection test mode", { connectionId, userId });

    const rawFilePath = FileUtil.getRawFilePath(outputDir, `test_${connectionId}`, "CSV");
    const csvFilePath = FileUtil.getCsvFilePath(outputDir, `test_${connectionId}`);

    let connectionName = "Unknown";
    let channelType = "HTTP";
    let formatType = "CSV";

    try {
      // 1. Fetch connection details
      const connection = await this._apiClient.getConnectionById(connectionId);
      connectionName = connection.name;
      channelType = connection.channel;
      formatType = connection.dataFormat;

      const actualRawPath = FileUtil.getRawFilePath(outputDir, `test_${connectionId}`, connection.dataFormat);

      // 2. Report progress: download
      await this._apiClient.reportTestResult(connectionId, {
        progress: "download",
      });

      // 3. Download data
      const downloader = this._downloaderFactory.getDownloader(connection.channel);
      await downloader.download(connection, actualRawPath);

      // 4. Report progress: convert
      await this._apiClient.reportTestResult(connectionId, {
        progress: "convert",
      });

      // 5. Convert data to standardized CSV
      const converter = this._converterFactory.getConverter(connection.dataFormat);
      await converter.convert(connection, actualRawPath, csvFilePath);

      // 6. Analyze converted CSV (streaming extraction)
      const sample = await this._analyzeCsv(csvFilePath);
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      // 7. Report progress: finish with success
      await this._apiClient.reportTestResult(connectionId, {
        progress: "finish",
        success: true,
        finished_at: finishedAt,
        duration_ms: durationMs,
        rowCount: sample.rowCount,
        columnCount: sample.columnCount,
        fileSize: sample.fileSize,
        columns: sample.columns,
        rows: sample.rows,
      });

      this._logger.info("Connection test completed successfully", {
        connectionId,
        rowCount: sample.rowCount,
        columnCount: sample.columnCount,
        durationMs,
      });

      return {
        userId,
        totalConnections: 1,
        activeConnections: 1,
        successCount: 1,
        errorCount: 0,
        results: [
          {
            connectionId,
            name: connectionName,
            channel: channelType as any,
            dataFormat: formatType as any,
            status: "OK",
            rawFilePath: actualRawPath,
            csvFilePath,
          },
        ],
      };
    } catch (error) {
      const errorMsg = ErrorUtil.stringifyError(error);
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      this._logger.error("Connection test failed", { connectionId, error: errorMsg });

      try {
        await this._apiClient.reportTestResult(connectionId, {
          progress: "finish",
          success: false,
          errorMessage: errorMsg,
          finished_at: finishedAt,
          duration_ms: durationMs,
        });
      } catch (reportErr) {
        this._logger.error("Failed to report test failure to backend", {
          connectionId,
          error: String(reportErr),
        });
      }

      return {
        userId,
        totalConnections: 1,
        activeConnections: 1,
        successCount: 0,
        errorCount: 1,
        results: [
          {
            connectionId,
            name: connectionName,
            channel: channelType as any,
            dataFormat: formatType as any,
            status: "ERROR",
            error: errorMsg,
            rawFilePath,
            csvFilePath,
          },
        ],
      };
    } finally {
      // Clean up temporary test files
      try {
        if (fs.existsSync(csvFilePath)) fs.unlinkSync(csvFilePath);
        if (fs.existsSync(rawFilePath)) fs.unlinkSync(rawFilePath);
      } catch {
        // Ignored
      }
    }
  }

  private async _analyzeCsv(csvFilePath: string): Promise<{
    columns: string[];
    columnCount: number;
    rows: string[][];
    rowCount: number;
    fileSize: number;
  }> {
    const fileSize = FileUtil.getFileSize(csvFilePath);

    return new Promise((resolve, reject) => {
      let columns: string[] = [];
      const rows: string[][] = [];
      let rowCount = 0;
      let isFirstLine = true;

      const fileStream = fs.createReadStream(csvFilePath, { encoding: "utf-8" });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (isFirstLine) {
          isFirstLine = false;
          columns = line.split(";").map((c) => c.replace(/^["']|["']$/g, "").trim());
        } else {
          rowCount++;
          if (rows.length < 3) {
            const cells = line.split(";").map((c) => c.replace(/^["']|["']$/g, "").trim());
            rows.push(cells);
          }
        }
      });

      rl.on("close", () => {
        resolve({
          columns,
          columnCount: columns.length,
          rows,
          rowCount,
          fileSize,
        });
      });

      rl.on("error", (err) => {
        reject(err);
      });
    });
  }
}
