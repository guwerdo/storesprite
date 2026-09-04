import fs from "node:fs";
import readline from "node:readline";
import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { AppConfig } from "../config/app.config.js";
import { IBackendApiClient } from "../types/backend-api-client.interface.js";
import { IDownloaderFactory } from "../types/downloader.interface.js";
import { IConverterFactory } from "../types/data-converter.interface.js";
import {
  IDownloaderService,
  DownloaderExecutionSummary,
} from "../types/downloader-service.interface.js";
import {
  DataConnectionChannel,
  DataConnectionFormat,
  DataConnectionDto,
} from "../types/connection.types.js";
import { FileUtil } from "../utils/file-util.js";
import { ErrorUtil } from "../utils/error-util.js";
import { CsvUtil } from "../utils/csv-util.js";

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
    const { outputDir, testConnectionId, connectionId } = this._config;

    // Single-connection test mode (legacy) is unchanged and wins first.
    if (testConnectionId) {
      return this._runTestMode(testConnectionId);
    }

    if (!connectionId) {
      const errorMsg =
        "Missing required environment variable: CONNECTION_ID (and no TEST_CONNECTION set)";
      this._logger.error("Downloader session aborted", { error: errorMsg });
      throw new Error(errorMsg);
    }

    this._logger.info("Starting Downloader session (single-connection mapping run)", {
      outputDir,
      backendUrl: this._config.backendUrl,
    });

    return this._runMappingConnection(connectionId);
  }

  private async _runMappingConnection(
    connectionId: string
  ): Promise<DownloaderExecutionSummary> {
    const { userId, outputDir, mappingId, runId } = this._config;
    FileUtil.ensureDirExists(outputDir);

    let connectionName = "Unknown";
    let channelType: DataConnectionChannel = "HTTP";
    let formatType: DataConnectionFormat = "CSV";

    try {
      // 1. Fetch the one connection this mapping run targets.
      const connection = await this._apiClient.getConnectionById(connectionId);
      connectionName = connection.name;
      channelType = connection.channel;
      formatType = connection.dataFormat;

      this._logger.info("Fetched connection for mapping run", {
        channel: channelType,
        dataFormat: formatType,
      });

      if (!connection.isActive) {
        throw new Error(
          `Connection '${connectionId}' is not active (isActive=false); refusing to download`
        );
      }

      const rawFilePath = FileUtil.getRawFilePath(outputDir, connectionId, connection.dataFormat);
      const csvFilePath = FileUtil.getCsvFilePath(outputDir, connectionId);

      // 2+3. Download the feed, then convert it to standardized CSV.
      const isUnchanged = await this._downloadAndConvert(connection, rawFilePath, csvFilePath);

      this._logger.info("Successfully processed connection", { csvFilePath, isUnchanged });

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
            channel: channelType,
            dataFormat: formatType,
            status: "OK",
            isUnchanged,
            rawFilePath,
            csvFilePath,
          },
        ],
      };
    } catch (error) {
      const errorMsg = ErrorUtil.stringifyError(error);
      this._logger.error("Error processing connection", { error: errorMsg });

      if (mappingId && runId) {
        try {
          await this._apiClient.reportRunError(mappingId, runId, errorMsg);
        } catch (reportErr) {
          this._logger.error("Failed to report mapping run error to backend", {
            error: ErrorUtil.stringifyError(reportErr),
          });
        }
      } else {
        this._logger.warn("Mapping run identity missing; skipping run-error report");
      }

      return {
        userId,
        totalConnections: 1,
        activeConnections: 0,
        successCount: 0,
        errorCount: 1,
        results: [
          {
            connectionId,
            name: connectionName,
            channel: channelType,
            dataFormat: formatType,
            status: "ERROR",
            error: errorMsg,
          },
        ],
      };
    }
  }

  private async _downloadAndConvert(
    connection: DataConnectionDto,
    rawFilePath: string,
    csvFilePath: string,
    reportStage?: (stage: "download" | "convert") => Promise<void>
  ): Promise<boolean> {
    if (reportStage) {
      await reportStage("download");
    }
    const downloader = this._downloaderFactory.getDownloader(connection.channel);
    const downloadResult = await downloader.download(connection, rawFilePath);
    if (reportStage) {
      await reportStage("convert");
    }
    const converter = this._converterFactory.getConverter(connection.dataFormat);
    await converter.convert(connection, rawFilePath, csvFilePath);
    return downloadResult.isUnchanged;
  }

  private async _runTestMode(connectionId: string): Promise<DownloaderExecutionSummary> {
    const startTime = Date.now();
    const { userId, outputDir } = this._config;
    FileUtil.ensureDirExists(outputDir);

    this._logger.info("Executing single connection test mode");

    const csvFilePath = FileUtil.getCsvFilePath(outputDir, `test_${connectionId}`);
    let rawFilePath = FileUtil.getRawFilePath(outputDir, `test_${connectionId}`, "CSV");

    let connectionName = "Unknown";
    let channelType: DataConnectionChannel = "HTTP";
    let formatType: DataConnectionFormat = "CSV";

    try {
      // 1. Fetch connection details
      const connection = await this._apiClient.getConnectionById(connectionId);
      connectionName = connection.name;
      channelType = connection.channel;
      formatType = connection.dataFormat;
      rawFilePath = FileUtil.getRawFilePath(outputDir, `test_${connectionId}`, connection.dataFormat);

      // 2. Download + convert, reporting stage progress to the backend between stages.
      await this._downloadAndConvert(connection, rawFilePath, csvFilePath, async (stage) => {
        await this._apiClient.reportTestResult(connectionId, { progress: stage });
      });

      // 3. Analyze converted CSV (streaming extraction)
      const sample = await this._analyzeCsv(csvFilePath);
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      // 4. Report progress: finish with success
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
            channel: channelType,
            dataFormat: formatType,
            status: "OK",
            rawFilePath,
            csvFilePath,
          },
        ],
      };
    } catch (error) {
      const errorMsg = ErrorUtil.stringifyError(error);
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      this._logger.error("Connection test failed", { error: errorMsg });

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
          error: ErrorUtil.stringifyError(reportErr),
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
            channel: channelType,
            dataFormat: formatType,
            status: "ERROR",
            error: errorMsg,
            rawFilePath,
            csvFilePath,
          },
        ],
      };
    } finally {
      // Clean up temporary test files
      FileUtil.deleteFileIfExists(csvFilePath);
      FileUtil.deleteFileIfExists(rawFilePath);
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

      const parseRow = (line: string): string[] =>
        CsvUtil.splitCsvRow(line, ";").map((cell) => cell.trim());

      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (isFirstLine) {
          isFirstLine = false;
          columns = parseRow(line);
        } else {
          rowCount++;
          if (rows.length < 3) {
            rows.push(parseRow(line));
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
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }
}
