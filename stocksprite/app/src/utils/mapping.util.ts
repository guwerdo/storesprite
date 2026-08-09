export function getNumberValue(value: unknown): number | undefined {
    if (typeof value === "number") return isNaN(value) ? undefined : value;
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
