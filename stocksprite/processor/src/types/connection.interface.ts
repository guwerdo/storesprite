import type { ISetProduct } from "@storesprite/unas-json-client";

/**
 * The desired end state for one product, derived from a single row of the
 * supplier CSV: warehouseId -> quantity (0 meaning "clear this warehouse").
 */
export interface DesiredState {
    desired: Map<number, number>;
}

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
