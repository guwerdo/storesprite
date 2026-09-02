import { inject, injectable } from "inversify";
import path from "node:path";
import type { Logger } from "log4js";
import { TYPES } from "../types/binding-keys.js";
import type { AppConfig } from "../config/app.config.js";
import type { IBackendApiClient } from "./backend-api-client.js";
import { ConnectionFeedService } from "./connection-feed.service.js";
import { UnasProductDbService } from "./unas-product-db.service.js";
import { UnasUpdateService } from "./unas-update.service.js";
import { ConnectionIndexRepository } from "../repository/connection-index.repository.js";
import type { UnasClientFactory } from "../types/mapping.interface.js";
import type { ProgressBody, ProgressStage } from "../types/mapping.interface.js";
import { createRunCounters, type RunCounters } from "../types/connection.interface.js";
import { stringifyError } from "../utils/error-util.js";

/**
 * Single-run orchestrator. One instance = one mapping run:
 *
 *   report start → fetch+validate run-config → build UNAS client
 *   → stream supplier CSV into the index (report parse)
 *   → download UNAS DB URL (report download → compare)
 *   → stream-join + diff + batch-send → report finish / error → exit code.
 */
@injectable()
export class ProcessorService {
    constructor(
        @inject(TYPES.AppConfig) private readonly _config: AppConfig,
        @inject(TYPES.Logger) private readonly _logger: Logger,
        @inject(TYPES.IBackendApiClient) private readonly _backend: IBackendApiClient,
        @inject(TYPES.UnasClientFactory) private readonly _clientFactory: UnasClientFactory,
        @inject(ConnectionIndexRepository) private readonly _index: ConnectionIndexRepository,
        @inject(ConnectionFeedService) private readonly _feed: ConnectionFeedService,
        @inject(UnasProductDbService) private readonly _productDb: UnasProductDbService,
        @inject(UnasUpdateService) private readonly _update: UnasUpdateService
    ) {}

    /** Runs the whole pipeline. Resolves with the process exit code (0 or 1). */
    public async run(): Promise<number> {
        const counters = createRunCounters();
        const { mappingId, runId } = this._config;
        this._logger.info("Stock processor run started", { mappingId, runId });

        try {
            await this._backend.reportProgress(mappingId, { runId, progress: "start" });

            const runConfig = await this._backend.getRunConfig(mappingId);
            const { mapping } = runConfig;
            this._logger.info("Run configuration fetched", {
                connectionId: mapping.connectionId,
                warehouseCount: runConfig.warehouses.length,
            });

            const client = this._clientFactory({
                baseUrl: runConfig.unasConfig.baseUrl,
                apiKey: runConfig.unasConfig.apiKey,
            });
            this._update.setClient(client);

            const feedPath = path.join(this._config.outputDir, `${mapping.connectionId}.csv`);
            const feed = await this._feed.buildIndex(feedPath, mapping);
            counters.processedItems = feed.processedItems;
            counters.warningCount += feed.skippedEmptySkus;

            if (feed.processedItems === 0) {
                this._logger.info("Supplier feed is empty; nothing to process");
                await this._reportProgress("finish", counters);
                return 0;
            }

            await this._reportProgress("parse", counters);
            await this._reportProgress("download", counters);

            const dbUrl = await this._productDb.fetchProductDbUrl(client);
            await this._reportProgress("compare", counters);

            const rows = await this._productDb.openDbStream(dbUrl);
            await this._productDb.streamAndCompare(rows, runConfig.warehouses, counters, (update) =>
                this._update.queue(update, counters)
            );
            await this._update.flush(counters);

            await this._reportProgress("finish", counters);
            this._logger.info("Stock processor run finished", { mappingId, runId, ...counters });
            return counters.errorCount > 0 ? 1 : 0;
        } catch (error) {
            const message = stringifyError(error);
            this._logger.error("Stock processor run failed", { error: message });
            try {
                await this._backend.reportProgress(mappingId, { runId, progress: "error", error: message });
            } catch (reportError) {
                this._logger.error("Failed to report the run error back to the backend", {
                    error: stringifyError(reportError),
                });
            }
            return 1;
        }
    }

    private async _reportProgress(progress: ProgressStage, counters: RunCounters): Promise<void> {
        const body: ProgressBody = { runId: this._config.runId, progress, ...counters };
        await this._backend.reportProgress(this._config.mappingId, body);
    }
}
