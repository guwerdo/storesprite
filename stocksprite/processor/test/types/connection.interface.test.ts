import { describe, expect, it } from "vitest";
import {
    SKU_NORMALIZATIONS_EXAMPLE_LIMIT,
    createEmptySkuNormalizations,
    createRunCounters,
    recordConvertedSku,
    recordTruncatedSku,
} from "../../src/types/connection.interface.js";

describe("connection.interface normalizations", () => {
    describe("createEmptySkuNormalizations", () => {
        it("returns the empty shape", () => {
            expect(createEmptySkuNormalizations()).toEqual({
                converted: { count: 0, examples: [] },
                truncated: { count: 0, examples: [] },
            });
        });
    });

    describe("createRunCounters", () => {
        it("initializes skuNormalizations to the empty shape", () => {
            expect(createRunCounters().skuNormalizations).toEqual(createEmptySkuNormalizations());
        });
    });

    describe("recordConvertedSku", () => {
        it("accumulates count across duplicates but stores one distinct example", () => {
            const n = createEmptySkuNormalizations();
            recordConvertedSku(n, "123.ASD", "123_ASD");
            recordConvertedSku(n, "123.ASD", "123_ASD");
            expect(n.converted.count).toBe(2);
            expect(n.converted.examples).toEqual([{ before: "123.ASD", after: "123_ASD" }]);
        });

        it("stores distinct examples up to the limit", () => {
            const n = createEmptySkuNormalizations();
            for (let i = 0; i < SKU_NORMALIZATIONS_EXAMPLE_LIMIT + 3; i += 1) {
                recordConvertedSku(n, `sku.${i}`, `sku_${i}`);
            }
            expect(n.converted.count).toBe(SKU_NORMALIZATIONS_EXAMPLE_LIMIT + 3);
            expect(n.converted.examples).toHaveLength(SKU_NORMALIZATIONS_EXAMPLE_LIMIT);
        });
    });

    describe("recordTruncatedSku", () => {
        it("accumulates count across duplicates but stores one distinct example", () => {
            const n = createEmptySkuNormalizations();
            const long = "z".repeat(60);
            recordTruncatedSku(n, long);
            recordTruncatedSku(n, long);
            expect(n.truncated.count).toBe(2);
            expect(n.truncated.examples).toEqual([long]);
        });

        it("stores distinct original SKUs up to the limit", () => {
            const n = createEmptySkuNormalizations();
            for (let i = 0; i < SKU_NORMALIZATIONS_EXAMPLE_LIMIT + 2; i += 1) {
                recordTruncatedSku(n, `z${i}`.repeat(30));
            }
            expect(n.truncated.count).toBe(SKU_NORMALIZATIONS_EXAMPLE_LIMIT + 2);
            expect(n.truncated.examples).toHaveLength(SKU_NORMALIZATIONS_EXAMPLE_LIMIT);
        });
    });
});
