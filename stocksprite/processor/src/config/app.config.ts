import path from "node:path";

/**
 * Environment contract for a single stock-sync run. Every value is read from
 * the process environment (the backend spawns this container with MAPPING_ID,
 * RUN_ID, INTERNAL_TOKEN, BACKEND_URL and OUTPUT_DIR set).
 */
export interface AppConfig {
    /** Identifier of the mapping to execute. Required. */
    mappingId: string;
    /** Identifier of the mapping_history run row the backend opened. Required. */
    runId: string;
    /** Shared secret used to call the internal backend endpoints. */
    internalToken: string;
    /** Base URL of storesprite-be (no trailing slash). */
    backendUrl: string;
    /** Directory the downloader wrote the supplier CSVs into. */
    outputDir: string;
}

export function getAppConfig(): AppConfig {
    const mappingId = process.env.MAPPING_ID?.trim();
    if (!mappingId) {
        throw new Error("Missing required environment variable: MAPPING_ID");
    }
    const runId = process.env.RUN_ID?.trim();
    if (!runId) {
        throw new Error("Missing required environment variable: RUN_ID");
    }

    const internalToken = process.env.INTERNAL_TOKEN?.trim();
    if (!internalToken && process.env.NODE_ENV === "production") {
        throw new Error("Missing required environment variable: INTERNAL_TOKEN");
    }
    const backendUrl = (process.env.BACKEND_URL?.trim() || "http://storesprite-be:3000").replace(/\/+$/, "");
    const outputDir = process.env.OUTPUT_DIR?.trim() || path.resolve(process.cwd(), "temp");

    return {
        mappingId,
        runId,
        internalToken: internalToken || "mock_internal_token",
        backendUrl,
        outputDir,
    };
}
