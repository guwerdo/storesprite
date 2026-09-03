import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import axios from "axios";
import { BackendApiClient } from "../../src/services/backend-api-client.js";
import type { AppConfig } from "../../src/config/app.config.js";
import type { RunConfigResponse } from "../../src/types/mapping.interface.js";
import { stubLogger } from "../helpers/stub-logger.js";

vi.mock("axios", () => {
    const get = vi.fn();
    const post = vi.fn();
    const isAxiosError = vi.fn();
    return { default: { get, post, isAxiosError } };
});

// The mocked module methods are the spies under test — detaching them (no `this` to
// bind on a plain mock object) is deliberate, so the rule is disabled for these two.
/* eslint-disable @typescript-eslint/unbound-method */
const axiosGetMock = axios.get as unknown as Mock;
const axiosPostMock = axios.post as unknown as Mock;
/* eslint-enable @typescript-eslint/unbound-method */
const axiosIsAxiosErrorMock = axios.isAxiosError as unknown as Mock;

const config: AppConfig = {
    mappingId: "m1",
    runId: "r1",
    internalToken: "internal-secret",
    backendUrl: "http://storesprite-be:3000",
    outputDir: "/tmp",
};

const validRunConfig: RunConfigResponse = {
    mapping: {
        id: "m1",
        connectionId: "conn-1",
        skuField: "SKU",
        skuRules: [],
        stockMappings: [{ column: "Raktár", warehouseId: 1 }],
    },
    unasConfig: { baseUrl: "http://127.0.0.1:9000/shop/", apiKey: "unas-key" },
    warehouses: [{ id: 1, name: "Fő raktár", publicName: "Fő raktár" }],
};

function makeClient(): BackendApiClient {
    return new BackendApiClient(config, stubLogger());
}

describe("BackendApiClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axiosIsAxiosErrorMock.mockReturnValue(false);
    });

    describe("getRunConfig", () => {
        it("returns the validated run config", async () => {
            axiosGetMock.mockResolvedValueOnce({ data: validRunConfig });
            await expect(makeClient().getRunConfig("m1")).resolves.toEqual(validRunConfig);
            expect(axiosGetMock).toHaveBeenCalledWith(
                "http://storesprite-be:3000/api/internal/stocksprite/mappings/m1/run-config",
                expect.objectContaining({ headers: { "x-internal-token": "internal-secret" } })
            );
        });

        it("rejects when the payload fails Ajv validation", async () => {
            axiosGetMock.mockResolvedValueOnce({ data: { mapping: {}, unasConfig: {}, warehouses: [] } });
            await expect(makeClient().getRunConfig("m1")).rejects.toThrow(/Run config validation failed/);
        });

        it("rejects when the request fails", async () => {
            axiosGetMock.mockRejectedValueOnce(new Error("net down"));
            await expect(makeClient().getRunConfig("m1")).rejects.toThrow(/net down/);
        });
    });

    describe("reportProgress", () => {
        it("posts the progress body to the progress endpoint", async () => {
            axiosPostMock.mockResolvedValueOnce({ status: 204 });
            const body = { runId: "r1", progress: "parse", processedItems: 5 } as const;
            await expect(makeClient().reportProgress("m1", body)).resolves.toBeUndefined();
            expect(axiosPostMock).toHaveBeenCalledWith(
                "http://storesprite-be:3000/api/internal/stocksprite/mappings/m1/progress",
                body,
                expect.objectContaining({ headers: { "x-internal-token": "internal-secret" } })
            );
        });

        it("rejects when the request fails", async () => {
            axiosPostMock.mockRejectedValueOnce(new Error("boom"));
            await expect(makeClient().reportProgress("m1", { runId: "r1", progress: "start" })).rejects.toThrow(
                /Failed to report progress 'start'/
            );
        });
    });
});
