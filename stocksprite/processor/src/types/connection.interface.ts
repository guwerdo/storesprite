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
    skuNormalizations: SkuNormalizations;
}

export function createRunCounters(): RunCounters {
    return {
        processedItems: 0,
        updatedItems: 0,
        unchangedItems: 0,
        warningCount: 0,
        errorCount: 0,
        skuNormalizations: createEmptySkuNormalizations(),
    };
}

/** Wire shape of one `before -> after` SKU conversion example. */
export interface SkuConversionExample {
    before: string;
    after: string;
}

/**
 * SKU normalizations applied while parsing the supplier CSV, carried on the
 * `finish` progress report and persisted on the run-history row. Hand-synced
 * with storesprite-be and storesprite-fe (field names must stay identical).
 */
export interface SkuNormalizations {
    converted: { count: number; examples: SkuConversionExample[] };
    truncated: { count: number; examples: string[] };
}

/** Distinct example SKUs kept per kind; older runs keep their first occurrences. */
export const SKU_NORMALIZATIONS_EXAMPLE_LIMIT = 5;

export function createEmptySkuNormalizations(): SkuNormalizations {
    return { converted: { count: 0, examples: [] }, truncated: { count: 0, examples: [] } };
}

/** Counts every conversion; stores up to LIMIT distinct `before` examples. */
export function recordConvertedSku(normalizations: SkuNormalizations, before: string, after: string): void {
    normalizations.converted.count += 1;
    if (
        normalizations.converted.examples.length < SKU_NORMALIZATIONS_EXAMPLE_LIMIT &&
        !normalizations.converted.examples.some((example) => example.before === before)
    ) {
        normalizations.converted.examples.push({ before, after });
    }
}

/** Counts every truncation; stores up to LIMIT distinct original SKUs. */
export function recordTruncatedSku(normalizations: SkuNormalizations, original: string): void {
    normalizations.truncated.count += 1;
    if (
        normalizations.truncated.examples.length < SKU_NORMALIZATIONS_EXAMPLE_LIMIT &&
        !normalizations.truncated.examples.includes(original)
    ) {
        normalizations.truncated.examples.push(original);
    }
}
