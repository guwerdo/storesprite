import { injectable, inject } from "inversify";
import axios from "axios";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { AppConfig } from "../config/app.config.js";
import { IBackendApiClient } from "../types/backend-api-client.interface.js";
import { DataConnectionDto, ConnectionTestResult } from "../types/connection.types.js";
import { ErrorUtil } from "../utils/error-util.js";

@injectable()
export class BackendApiClient implements IBackendApiClient {
  constructor(
    @inject(TYPES.AppConfig) private readonly _config: AppConfig,
    @inject(TYPES.Logger) private readonly _logger: Logger
  ) {}

  private _extractErrorMessage(error: unknown): string {
    const base = ErrorUtil.stringifyError(error);
    if (axios.isAxiosError(error) && error.response?.data) {
      const responseData = error.response.data as { error?: string; message?: string };
      return responseData.error || responseData.message || `HTTP ${error.response.status}: ${error.message}`;
    }
    return base;
  }

  public async getConnectionById(connectionId: string): Promise<DataConnectionDto> {
    const url = `${this._config.backendUrl}/api/internal/stocksprite/connections/${connectionId}`;
    this._logger.info("Fetching single connection from backend", { connectionId, url });

    try {
      const response = await axios.get<{ connection: DataConnectionDto }>(url, {
        headers: {
          "x-internal-token": this._config.internalToken,
        },
        timeout: 10000,
      });

      if (!response.data?.connection) {
        throw new Error(`Connection '${connectionId}' not found in backend response`);
      }

      return response.data.connection;
    } catch (error) {
      const errorMsg = this._extractErrorMessage(error);
      this._logger.error("Failed to fetch connection from backend", {
        connectionId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to fetch connection '${connectionId}': ${errorMsg}`);
    }
  }

  public async reportTestResult(
    connectionId: string,
    result: Partial<ConnectionTestResult>
  ): Promise<void> {
    const url = `${this._config.backendUrl}/api/internal/stocksprite/connections/${connectionId}/test-result`;
    this._logger.info("Reporting test result to backend", { connectionId, progress: result.progress });

    try {
      await axios.patch(url, result, {
        headers: {
          "x-internal-token": this._config.internalToken,
        },
        timeout: 15000,
      });
    } catch (error) {
      const errorMsg = this._extractErrorMessage(error);
      this._logger.error("Failed to report test result to backend", {
        connectionId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to report test result for '${connectionId}': ${errorMsg}`);
    }
  }

  public async reportRunError(mappingId: string, runId: string, error: string): Promise<void> {
    const url = `${this._config.backendUrl}/api/internal/stocksprite/mappings/${mappingId}/progress`;
    this._logger.info("Reporting mapping run error to backend", { mappingId, runId, url });

    try {
      await axios.post(
        url,
        { runId, progress: "error", error },
        {
          headers: {
            "x-internal-token": this._config.internalToken,
          },
          timeout: 15000,
        }
      );
    } catch (err) {
      const errorMsg = this._extractErrorMessage(err);
      this._logger.error("Failed to report mapping run error to backend", {
        mappingId,
        runId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to report run error for mapping '${mappingId}': ${errorMsg}`);
    }
  }
}
