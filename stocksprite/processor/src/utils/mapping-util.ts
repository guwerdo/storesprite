import type { ISetProductStock } from "@storesprite/unas-json-client";

/** UNAS's main warehouse id: its stock is the unprefixed "Raktárkészlet" column and its serialized stock omits `warehouseId`. */
export const MAIN_WAREHOUSE_ID = 1;

/** UNAS SKU max length (see UNAS "Sku" field spec). */
export const UNAS_SKU_MAX_LENGTH = 50;

/** Converts a value to a number. When `lenient`, an empty or non-numeric string yields undefined instead of throwing. */
export function getNumberValue(value: unknown, lenient = false): number | undefined {
    if (typeof value === "number") {
        return Number.isNaN(value) ? undefined : value;
    }
    if (typeof value === "string") {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            if (lenient) {
                return undefined;
            }
            throw new Error("Cannot convert empty string to number");
        }
        const number = Number(trimmedValue);
        if (Number.isNaN(number)) {
            if (lenient) {
                return undefined;
            }
            throw new Error(`Cannot convert value to number. Value: ${value}`);
        }
        return number;
    }
    return undefined;
}

/** Returns the value when it is a non-empty string; undefined otherwise. */
export function getStringValue(value: unknown): string | undefined {
    if (value == null || typeof value !== "string" || value.length === 0) {
        return undefined;
    }
    return value;
}

/** Result of a SKU normalization, reporting which transformations were applied. */
export interface SkuNormalization {
    sku: string;
    converted: boolean;
    truncated: boolean;
}

/**
 * Normalizes a SKU to UNAS format: only [A-Za-z0-9_-] survive, any other
 * character becomes "_", and the result is truncated to UNAS_SKU_MAX_LENGTH.
 * Mirrors how UNAS rewrites disallowed SKU characters when storing a product.
 */
export function normalizeSku(sku: string): SkuNormalization {
    const replaced = sku.replace(/[^A-Za-z0-9_-]/g, "_");
    const truncated = replaced.length > UNAS_SKU_MAX_LENGTH;
    return {
        sku: truncated ? replaced.slice(0, UNAS_SKU_MAX_LENGTH) : replaced,
        converted: replaced !== sku,
        truncated,
    };
}

/** Normalizes a SKU to UNAS format, returning only the resulting string. */
export function toUnasSku(sku: string): string {
    return normalizeSku(sku).sku;
}

export function negativeToZero(value: number): number {
    return value < 0 ? 0 : value;
}

/** True when both maps hold identical warehouseId -> quantity entries. */
export function stocksEqual(a: ReadonlyMap<number, number>, b: ReadonlyMap<number, number>): boolean {
    if (a.size !== b.size) {
        return false;
    }
    for (const [warehouseId, quantity] of a) {
        if (!b.has(warehouseId) || b.get(warehouseId) !== quantity) {
            return false;
        }
    }
    return true;
}

/**
 * The supplier is authoritative: the target state starts from what the supplier
 * wants, and every warehouse currently stocked on UNAS but not covered by the
 * row is zeroed out (the main warehouse id 1 included).
 */
export function computeFinalStocks(
    current: ReadonlyMap<number, number>,
    desired: ReadonlyMap<number, number>
): Map<number, number> {
    const final = new Map<number, number>();
    for (const [warehouseId, quantity] of desired) {
        final.set(warehouseId, quantity);
    }
    for (const [warehouseId] of current) {
        if (!final.has(warehouseId)) {
            final.set(warehouseId, 0);
        }
    }
    return final;
}

/** Serializes a warehouse->quantity map into the UNAS stock array. The main warehouse omits warehouseId. */
export function toStockArray(stocks: ReadonlyMap<number, number>): ISetProductStock[] {
    const result: ISetProductStock[] = [];
    for (const [warehouseId, quantity] of stocks) {
        result.push(warehouseId === MAIN_WAREHOUSE_ID ? { quantity } : { warehouseId, quantity });
    }
    return result;
}
