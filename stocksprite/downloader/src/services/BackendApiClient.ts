import { injectable, inject } from "inversify";
import axios from "axios";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { AppConfig } from "../config/app.config.js";
import { IBackendApiClient } from "../types/BackendApiClient.interface.js";
import { DataConnectionDto } from "../types/Connection.types.js";
import { ErrorUtil } from "../utils/error-util.js";

@injectable()
export class BackendApiClient implements IBackendApiClient {
  constructor(
    @inject(TYPES.AppConfig) private readonly _config: AppConfig,
    @inject(TYPES.Logger) private readonly _logger: Logger
  ) {}

  public async getUserConnections(userId: string): Promise<DataConnectionDto[]> {
    const url = `${this._config.backendUrl}/api/worker/users/${userId}/connections`;
    this._logger.info("Fetching user connections from backend", { userId, url });

    try {
      const response = await axios.get<{ connections: DataConnectionDto[] }>(url, {
        headers: {
          "x-worker-token": this._config.workerToken,
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
      let errorMsg = ErrorUtil.stringifyError(error);
      if (axios.isAxiosError(error) && error.response?.data) {
        const responseData = error.response.data as { error?: string; message?: string };
        errorMsg = responseData.error || responseData.message || `HTTP ${error.response.status}: ${error.message}`;
      }
      this._logger.error("Failed to fetch user connections from backend", {
        userId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to fetch user connections for user '${userId}': ${errorMsg}`);
    }
  }
}
