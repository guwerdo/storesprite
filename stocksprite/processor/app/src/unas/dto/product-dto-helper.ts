import deepmerge, { ArrayMergeOptions } from "deepmerge";
import stringify from "fast-json-stable-stringify";
import { diff } from "just-diff";

import { IDtoDifference, IProductDto } from "./interfaces/index.js";

// Compare two ProductDto plain JS object.
// Objets must be 'JSON.parse(stringify(rightProductDto)) as ProductDto;'
// first if they are not plain JS objects.
export function comparePlainProductDto(leftProductDto: IProductDto, rightProductDto: IProductDto): IDtoDifference[] {
    if (!isPlainObject(leftProductDto) || !isPlainObject(rightProductDto)) {
        throw new Error("Both arguments must be plain JavaScript objects.");
    }

    // Normalize objects to ensure consistent comparison for arrays.
    // So arrays with same elements in different order are considered equal.
    const normalizedLeft = normalize(leftProductDto);
    const normalizedRight = normalize(rightProductDto);

    return diff(normalizedLeft as object, normalizedRight as object) as IDtoDifference[];
}

export function mergePlainProductDto(targetProductDto: IProductDto, sourceProductDto: IProductDto): IProductDto {
    if (!isPlainObject(targetProductDto) || !isPlainObject(sourceProductDto)) {
        throw new Error("Both arguments must be plain JavaScript objects.");
    }

    const merged = deepmerge(targetProductDto, sourceProductDto, {
        // These are the ids of the arrays in ProductDto that should be merged by id.
        // Update the array with the key name if a new key is added in ProductDto that should be merged by id.
        arrayMerge: arrayMergeByKey(["id", "warehouseId"]),
    });
    return merged;
}

export function normalize(value: unknown): unknown {
    if (Array.isArray(value)) {
        const normalized = (value as unknown[]).map((v) => normalize(v));
        normalized.sort((a, b) => stringify(a).localeCompare(stringify(b)));
        return normalized;
    } else if (isPlainObject(value)) {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = normalize(val);
        }
        return result;
    }

    return value;
}

function arrayMergeByKey<T extends object>(keys: (keyof T)[]) {
    return function mergeArrays(target: T[], source: T[], _?: ArrayMergeOptions): T[] {
        const merged: T[] = [...target];

        for (const s of source) {
            if (s && typeof s === "object") {
                // find first key in keys that exists in the object
                const matchKey = keys.find((k) => k in s);
                if (matchKey) {
                    const idx = merged.findIndex((t) => t && typeof t === "object" && t[matchKey] === s[matchKey]);
                    if (idx >= 0) {
                        merged[idx] = deepmerge(merged[idx], s);
                    } else {
                        merged.push(s);
                    }
                } else {
                    merged.push(s);
                }
            }
        }

        return merged;
    };
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
    if (obj === null || typeof obj !== "object") return false;
    const proto = Reflect.getPrototypeOf(obj);
    return proto === Object.prototype || proto === null;
}
