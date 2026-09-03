import { describe, expect, it } from "vitest";
import {
    MAIN_WAREHOUSE_ID,
    computeFinalStocks,
    getNumberValue,
    getStringValue,
    negativeToZero,
    stocksEqual,
    toStockArray,
} from "../../src/utils/mapping-util.js";

describe("mapping-util", () => {
    describe("getNumberValue", () => {
        it("returns a number unchanged", () => {
            expect(getNumberValue(5)).toBe(5);
        });
        it("returns undefined for NaN", () => {
            expect(getNumberValue(Number.NaN)).toBeUndefined();
        });
        it("parses a numeric string", () => {
            expect(getNumberValue(" 42 ")).toBe(42);
        });
        it("throws for an empty string when strict", () => {
            expect(() => getNumberValue("")).toThrow("Cannot convert empty string to number");
        });
        it("returns undefined for an empty string when lenient", () => {
            expect(getNumberValue("", true)).toBeUndefined();
        });
        it("throws for a non-numeric string when strict", () => {
            expect(() => getNumberValue("abc")).toThrow("Cannot convert value to number");
        });
        it("returns undefined for a non-numeric string when lenient", () => {
            expect(getNumberValue("abc", true)).toBeUndefined();
        });
        it("returns undefined for null/undefined/objects", () => {
            expect(getNumberValue(null)).toBeUndefined();
            expect(getNumberValue(undefined)).toBeUndefined();
            expect(getNumberValue({})).toBeUndefined();
        });
    });

    describe("getStringValue", () => {
        it("returns a non-empty string", () => {
            expect(getStringValue("sku")).toBe("sku");
        });
        it("returns undefined for empty/null/undefined/non-string", () => {
            expect(getStringValue("")).toBeUndefined();
            expect(getStringValue(null)).toBeUndefined();
            expect(getStringValue(undefined)).toBeUndefined();
            expect(getStringValue(123)).toBeUndefined();
        });
    });

    describe("negativeToZero", () => {
        it("clamps negatives to zero and passes through non-negatives", () => {
            expect(negativeToZero(-5)).toBe(0);
            expect(negativeToZero(0)).toBe(0);
            expect(negativeToZero(3)).toBe(3);
        });
    });

    describe("stocksEqual", () => {
        it("is true for identical maps", () => {
            expect(stocksEqual(new Map([[1, 5]]), new Map([[1, 5]]))).toBe(true);
        });
        it("is false for different sizes", () => {
            expect(stocksEqual(new Map([[1, 5]]), new Map())).toBe(false);
        });
        it("is false for same size but different values", () => {
            expect(stocksEqual(new Map([[1, 5]]), new Map([[1, 6]]))).toBe(false);
        });
    });

    describe("computeFinalStocks", () => {
        it("keeps desired values and zeroes current warehouses not covered by desired", () => {
            const current = new Map([[1, 3], [2, 4]]);
            const desired = new Map([[1, 9]]);
            expect([...computeFinalStocks(current, desired).entries()]).toEqual([[1, 9], [2, 0]]);
        });
        it("adds desired warehouses even when absent from current", () => {
            const current = new Map<number, number>();
            const desired = new Map([[2, 7]]);
            expect([...computeFinalStocks(current, desired).entries()]).toEqual([[2, 7]]);
        });
    });

    describe("toStockArray", () => {
        it("omits warehouseId for the main warehouse", () => {
            expect(toStockArray(new Map([[MAIN_WAREHOUSE_ID, 5]]))).toEqual([{ quantity: 5 }]);
        });
        it("includes warehouseId for additional warehouses", () => {
            expect(toStockArray(new Map([[MAIN_WAREHOUSE_ID, 1], [2, 3]]))).toEqual([
                { quantity: 1 },
                { warehouseId: 2, quantity: 3 },
            ]);
        });
    });
});
