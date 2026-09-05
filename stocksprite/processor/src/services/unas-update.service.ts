import { inject, injectable } from "inversify";
import type { Logger } from "log4js";
import { UnasHttpError } from "@storesprite/unas-json-client";
import type { IUnasJsonClient, ISetProduct } from "@storesprite/unas-json-client";
import { TYPES } from "../types/binding-keys.js";
import type { RunCounters } from "../types/connection.interface.js";
import { delay } from "../utils/http-util.js";
import { toUnasSku } from "../utils/mapping-util.js";

/** UNAS accepts up to 100 products per setProduct call. */
export const MAX_BATCH_SIZE = 100;
/** 1 initial attempt + 2 retries when UNAS answers HTTP 429. */
export const MAX_ATTEMPTS = 3;
/** Backoff between 429 retries (attempt 1 → 2s, attempt 2 → 4s). */
const RETRY_DELAYS_MS = [2_000, 4_000];

/**
 * Stage 3: accumulate emitted diffs into a ≤100 buffer and send them to UNAS.
 * A per-product `status:"error"` is partial (the run continues and exits
 * non-zero); a transport/HTTP/auth error is fatal; HTTP 429 retries the whole
 * chunk up to MAX_ATTEMPTS before becoming fatal.
 */
@injectable()
export class UnasUpdateService {
    private readonly _buffer: ISetProduct[] = [];
    private _client: IUnasJsonClient | null = null;

    constructor(@inject(TYPES.Logger) private readonly _logger: Logger) {}

    /** Attach the UNAS client once the run config is validated. */
    public setClient(client: IUnasJsonClient): void {
        this._client = client;
    }

    /** Enqueue one diff; flushes as soon as the buffer reaches 100. The SKU is normalized to UNAS format before buffering. */
    public async queue(update: ISetProduct, counters: RunCounters): Promise<void> {
        this._buffer.push({ ...update, sku: toUnasSku(update.sku) });
        if (this._buffer.length >= MAX_BATCH_SIZE) {
            await this.flush(counters);
        }
    }

    /** Sends the whole buffer in ≤100 chunks (called once the stream is drained). */
    public async flush(counters: RunCounters): Promise<void> {
        while (this._buffer.length > 0) {
            const chunk = this._buffer.splice(0, MAX_BATCH_SIZE);
            await this._sendChunk(chunk, counters);
        }
    }

    private async _sendChunk(chunk: ISetProduct[], counters: RunCounters): Promise<void> {
        const client = this._client;
        if (client === null) {
            throw new Error("UNAS client has not been attached");
        }
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
            try {
                const responses = await client.setProduct({ products: chunk });
                counters.updatedItems += chunk.length;
                if (responses.length !== chunk.length) {
                    counters.warningCount += 1;
                    this._logger.warn("setProduct response count does not match the sent batch", {
                        sent: chunk.length,
                        received: responses.length,
                    });
                }
                let productErrors = 0;
                for (const response of responses) {
                    if (response.status === "error") {
                        counters.errorCount += 1;
                        productErrors += 1;
                        this._logger.error("UNAS rejected a product update", { sku: response.sku, id: response.id });
                    }
                }
                this._logger.info("Sent stock batch to UNAS", {
                    batchSize: chunk.length,
                    productErrors,
                });
                return;
            } catch (error) {
                if (!(error instanceof UnasHttpError) || error.status !== 429 || attempt === MAX_ATTEMPTS) {
                    throw error;
                }
                counters.warningCount += 1;
                const waitMs = RETRY_DELAYS_MS[attempt - 1];
                this._logger.warn("Rate limited by UNAS (HTTP 429); retrying batch", {
                    attempt: attempt + 1,
                    waitMs,
                });
                await delay(waitMs);
            }
        }
    }
}
