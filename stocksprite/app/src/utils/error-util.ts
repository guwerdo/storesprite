import stringify from "fast-json-stable-stringify";

export function stringifyError(error: unknown) {
    if (error instanceof Error) {
        return stringify({
            name: error.name,
            message: error.message,
        });
    }
    return stringify(error);
}
