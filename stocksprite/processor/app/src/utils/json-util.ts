import { AnySchema } from "ajv";
import { existsSync, readFileSync, statSync } from "fs";

export function loadJsonSchema(filePath: string): AnySchema {
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
        throw new Error(`Schema file not found: ${filePath}`);
    }

    const schema = readFileSync(filePath, "utf8");
    const parsedSchema: unknown = JSON.parse(schema);
    if (parsedSchema === null || typeof parsedSchema !== "object") {
        throw new Error("Invalid JSON schema.");
    }
    return parsedSchema as AnySchema;
}

export function loadJson(filePath: string): unknown {
    if (!filePath) {
        throw new Error(`Schema file not found: ${filePath}`);
    }

    const jsonData = readFileSync(filePath, "utf8");
    const parsedData: unknown = JSON.parse(jsonData) as unknown;
    if (parsedData === null || typeof parsedData !== "object") {
        throw new Error("Invalid JSON data.");
    }
    return parsedData;
}
