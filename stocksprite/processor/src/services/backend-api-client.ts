import { inject, injectable } from "inversify";
import { Ajv, type AnySchema, type ValidateFunction } from "ajv";
import axios from "axios";
import type { Logger } from "log4js";
import { TYPES } from "../types/binding-keys.js";
import type { AppConfig } from "../config/app.config.js";
import { runConfigSchema } from "../config/run-config.schema.js";
import type { ProgressBody, RunConfigResponse } from "../types/mapping.interface.js";
import { extractErrorMessage } from "../utils/http-util.js";

export interface IBackendApiClient {
    getRunConfig(mappingId: string): Promise<RunConfigResponse>;
    reportProgress(mappingId: string, body: ProgressBody): Promise<void>;
}

/**
 * Talks to storesprite-be's internal endpoints (guarded by x-internal-token).
 * The run-config payload is Ajv-validated here so a misconfigured mapping aborts
 * the run before any UNAS write is attempted.
 */
@injectable()
export class BackendApiClient implements IBackendApiClient {
    private readonly _validateRunConfig: ValidateFunction;

    constructor(
        @inject(TYPES.AppConfig) private readonly _config: AppConfig,
        @inject(TYPES.Logger) private readonly _logger: Logger
    ) {
        this._validateRunConfig = new Ajv({ allErrors: true, allowUnionTypes: true }).compile(runConfigSchema as AnySchema);
    }

    public async getRunConfig(mappingId: string): Promise<RunConfigResponse> {
        const url = `${this._config.backendUrl}/api/internal/stocksprite/mappings/${mappingId}/run-config`;
        this._logger.info("Fetching run configuration from backend", { mappingId, url });
        try {
            const response = await axios.get<unknown>(url, {
                headers: { "x-internal-token": this._config.internalToken },
                timeout: 15000,
            });
            const body = response.data;
            if (!this._validateRunConfig(body)) {
                const detail = this._validateRunConfig.errors
                    ? this._validateRunConfig.errors.map((e) => `${e.instancePath} ${e.message ?? ""}`.trim()).join("; ")
                    : "unknown validation error";
                this._logger.error("Run configuration failed Ajv validation", { mappingId, detail });
                throw new Error(`Run config validation failed: ${detail}`);
            }
            return body as RunConfigResponse;
        } catch (error) {
            const message = extractErrorMessage(error, "Failed to fetch run configuration");
            this._logger.error("Failed to fetch run configuration", { mappingId, error: message });
            throw new Error(`Failed to fetch run configuration for mapping '${mappingId}': ${message}`);
        }
    }

    public async reportProgress(mappingId: string, body: ProgressBody): Promise<void> {
        const url = `${this._config.backendUrl}/api/internal/stocksprite/mappings/${mappingId}/progress`;
        try {
            await axios.post(url, body, {
                headers: { "x-internal-token": this._config.internalToken },
                timeout: 15000,
            });
            this._logger.info("Reported progress to backend", { mappingId, progress: body.progress });
        } catch (error) {
            const message = extractErrorMessage(error, "Failed to report progress");
            this._logger.error("Failed to report progress", { mappingId, progress: body.progress, error: message });
            throw new Error(
                `Failed to report progress '${body.progress}' for mapping '${mappingId}': ${message}`
            );
        }
    }
}
