import type { ISetProduct } from "@storesprite/unas-json-client";

/** A stock update queued for UNAS — the processor's send-buffer unit. */
export type ProductUpdate = ISetProduct;

/**
 * Tally of the whole run. Services mutate the shared instance as they stream;
 * the processor reports it back on `finish`/`error`.
 */
export interface RunCounters {
    processedItems: number;
    updatedItems: number;
    unchangedItems: number;
    warningCount: number;
    errorCount: number;
}

export function createRunCounters(): RunCounters {
    return {
        processedItems: 0,
        updatedItems: 0,
        unchangedItems: 0,
        warningCount: 0,
        errorCount: 0,
    };
}
