import type { ISetProductStock } from "@storesprite/unas-json-client";

/** Converts a value to a number. Throws when the value is an empty or non-numeric string. */
export function getNumberValue(value: unknown): number | undefined {
    if (typeof value === "number") {
        return Number.isNaN(value) ? undefined : value;
    }
    if (typeof value === "string") {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            throw new Error("Cannot convert empty string to number");
        }
        const number = Number(trimmedValue);
        if (Number.isNaN(number)) {
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

export function negativeToZero(value: number): number {
    return value < 0 ? 0 : value;
}

export function isObject(value: unknown): boolean {
    return typeof value === "object" && value !== null;
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

/** Serializes a warehouse->quantity map into the UNAS stock array. Main warehouse 1 omits warehouseId. */
export function toStockArray(stocks: ReadonlyMap<number, number>): ISetProductStock[] {
    const result: ISetProductStock[] = [];
    for (const [warehouseId, quantity] of stocks) {
        result.push(warehouseId === 1 ? { quantity } : { warehouseId, quantity });
    }
    return result;
}
