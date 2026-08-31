import { injectable, inject } from "inversify";
import axios from "axios";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { AppConfig } from "../config/app.config.js";
import { IBackendApiClient } from "../types/BackendApiClient.interface.js";
import { DataConnectionDto, ConnectionTestResult } from "../types/Connection.types.js";
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

  public async getUserConnections(userId: string): Promise<DataConnectionDto[]> {
    const url = `${this._config.backendUrl}/api/internal/stocksprite/users/${userId}/connections`;
    this._logger.info("Fetching user connections from backend", { userId, url });

    try {
      const response = await axios.get<{ connections: DataConnectionDto[] }>(url, {
        headers: {
          "x-internal-token": this._config.internalToken,
        },
        timeout: 10000,
      });

      const connections = response.data?.connections || [];
      this._logger.info("Successfully fetched user connections", {
        userId,
        count: connections.length,
      });

      return connections;
    } catch (error) {
      const errorMsg = this._extractErrorMessage(error);
      this._logger.error("Failed to fetch user connections from backend", {
        userId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to fetch user connections for user '${userId}': ${errorMsg}`);
    }
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
}
