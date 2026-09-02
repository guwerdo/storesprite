export function stringifyError(error: unknown): string {
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }
    if (error !== null && typeof error === "object") {
        try {
            return JSON.stringify(error);
        } catch {
            return Object.prototype.toString.call(error);
        }
    }
    if (typeof error === "string") {
        return error;
    }
    return JSON.stringify(error);
}
