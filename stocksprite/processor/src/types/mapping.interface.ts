import type { MappingRule, StockMappingItem } from "@storesprite/mapping-rules";
import type { IUnasJsonClient, IUnasJsonClientConfig } from "@storesprite/unas-json-client";

/** Run-config subset of a Mapping (as served by the backend run-config endpoint). */
export interface MappingDto {
    id: string;
    connectionId: string;
    skuField: string;
    skuRules?: MappingRule[];
    stockMappings: StockMappingItem[];
}

export interface UnasConfigDto {
    baseUrl: string;
    apiKey: string;
}

/** A warehouse returned by the backend (IWarehouseResponse). id 1 = main warehouse. */
export interface WarehouseDto {
    id: number;
    name: string;
    publicName: string;
}

/** Full response of `GET /mappings/:id/run-config`. */
export interface RunConfigResponse {
    mapping: MappingDto;
    unasConfig: UnasConfigDto;
    warehouses: WarehouseDto[];
}

export type ProgressStage = "start" | "parse" | "download" | "compare" | "send" | "finish" | "error";

/** Body posted to `POST /mappings/:id/progress`. */
export interface ProgressBody {
    runId: string;
    progress: ProgressStage;
    error?: string;
    processedItems?: number;
    updatedItems?: number;
    unchangedItems?: number;
    warningCount?: number;
    errorCount?: number;
}

/** Builds the @storesprite/unas-json-client once the run config is validated. */
export type UnasClientFactory = (config: IUnasJsonClientConfig) => IUnasJsonClient;
