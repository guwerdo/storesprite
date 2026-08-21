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
    const { userId, outputDir } = this._config;

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
}
