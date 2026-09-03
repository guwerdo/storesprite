import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import type { IUnasJsonClient } from "@storesprite/unas-json-client";
import { stubLogger } from "../helpers/stub-logger.js";
import type { AppConfig } from "../../src/config/app.config.js";
import type { RunConfigResponse, ProgressBody, UnasClientFactory } from "../../src/types/mapping.interface.js";
import { ConnectionIndexRepository } from "../../src/repository/connection-index.repository.js";
import { ProcessorService } from "../../src/services/processor.service.js";
import type { IBackendApiClient } from "../../src/services/backend-api-client.js";
import type { ConnectionFeedService } from "../../src/services/connection-feed.service.js";
import type { UnasProductDbService } from "../../src/services/unas-product-db.service.js";
import type { UnasUpdateService } from "../../src/services/unas-update.service.js";

const runConfig: RunConfigResponse = {
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

const config: AppConfig = {
    mappingId: "m1",
    runId: "run-1",
    internalToken: "internal-secret",
    backendUrl: "http://storesprite-be:3000",
    outputDir: "/tmp",
};

interface Harness {
    service: ProcessorService;
    reportProgress: ReturnType<typeof vi.fn<(mappingId: string, body: ProgressBody) => Promise<void>>>;
    getRunConfig: ReturnType<typeof vi.fn<(mappingId: string) => Promise<RunConfigResponse>>>;
    clientFactory: ReturnType<typeof vi.fn<UnasClientFactory>>;
    feedBuildIndex: ReturnType<
        typeof vi.fn<(filePath: string, mapping: typeof runConfig.mapping) => Promise<{ processedItems: number; skippedEmptySkus: number }>>
    >;
    productDbFetch: ReturnType<typeof vi.fn>;
    productDbCompare: ReturnType<typeof vi.fn>;
    updateFlush: ReturnType<typeof vi.fn>;
}

function makeService(opts: { processedItems?: number; configFailure?: boolean; compareErrorCount?: number } = {}): Harness {
    const { processedItems = 2, configFailure = false, compareErrorCount = 0 } = opts;
    const logger = stubLogger();

    const reportProgress = vi.fn<(mappingId: string, body: ProgressBody) => Promise<void>>().mockResolvedValue(undefined);
    const getRunConfig = vi.fn<(mappingId: string) => Promise<RunConfigResponse>>().mockImplementation(() => {
        if (configFailure) {
            return Promise.reject(new Error("config exploded"));
        }
        return Promise.resolve(runConfig);
    });
    const backend = { getRunConfig, reportProgress } as unknown as IBackendApiClient;

    const clientFactory = vi.fn<UnasClientFactory>().mockReturnValue({} as IUnasJsonClient);
    const index = new ConnectionIndexRepository();

    const feedBuildIndex = vi
        .fn<(filePath: string, mapping: typeof runConfig.mapping) => Promise<{ processedItems: number; skippedEmptySkus: number }>>()
        .mockResolvedValue({ processedItems, skippedEmptySkus: 0 });
    const feed = { buildIndex: feedBuildIndex } as unknown as ConnectionFeedService;

    const productDbFetch = vi.fn().mockResolvedValue("http://db/x.csv");
    const productDbOpen = vi.fn().mockResolvedValue([]);
    const productDbCompare = vi.fn(
        (_rows: unknown, _warehouses: unknown, counters: { unchangedItems: number; errorCount: number }) => {
            counters.unchangedItems = 4;
            counters.errorCount = compareErrorCount;
            return Promise.resolve();
        }
    );
    const productDb = {
        fetchProductDbUrl: productDbFetch,
        openDbStream: productDbOpen,
        streamAndCompare: productDbCompare,
    } as unknown as UnasProductDbService;

    const updateSetClient = vi.fn();
    const updateFlush = vi.fn().mockResolvedValue(undefined);
    const update = { setClient: updateSetClient, queue: vi.fn().mockResolvedValue(undefined), flush: updateFlush } as unknown as UnasUpdateService;

    const service = new ProcessorService(config, logger, backend, clientFactory, index, feed, productDb, update);

    return { service, reportProgress, getRunConfig, clientFactory, feedBuildIndex, productDbFetch, productDbCompare, updateFlush };
}

describe("ProcessorService", () => {
    it("runs the full pipeline and reports start→parse→download→compare→finish", async () => {
        const h = makeService();
        const exit = await h.service.run();

        expect(exit).toBe(0);
        expect(h.reportProgress).toHaveBeenCalledTimes(5);
        expect(h.reportProgress.mock.calls.map((call) => call[1].progress)).toEqual([
            "start",
            "parse",
            "download",
            "compare",
            "finish",
        ]);
        expect(h.feedBuildIndex).toHaveBeenCalledWith(path.join(config.outputDir, "conn-1.csv"), runConfig.mapping);
        expect(h.clientFactory).toHaveBeenCalledWith({ baseUrl: runConfig.unasConfig.baseUrl, apiKey: runConfig.unasConfig.apiKey });
        expect(h.productDbFetch).toHaveBeenCalledTimes(1);
        expect(h.updateFlush).toHaveBeenCalledTimes(1);

        const finish = h.reportProgress.mock.calls[4][1];
        expect(finish).toMatchObject({
            runId: "run-1",
            progress: "finish",
            processedItems: 2,
            unchangedItems: 4,
            errorCount: 0,
        });
    });

    it("exits 1 after a partial run when some products errored on UNAS", async () => {
        const h = makeService({ compareErrorCount: 2 });
        const exit = await h.service.run();

        expect(exit).toBe(1);
        expect(h.reportProgress.mock.calls.map((call) => call[1].progress)).toEqual([
            "start",
            "parse",
            "download",
            "compare",
            "finish",
        ]);
        expect(h.reportProgress.mock.calls[4][1]).toMatchObject({ progress: "finish", errorCount: 2 });
    });

    it("finishes cleanly (exit 0) when the supplier feed is empty", async () => {
        const h = makeService({ processedItems: 0 });
        const exit = await h.service.run();

        expect(exit).toBe(0);
        expect(h.reportProgress.mock.calls.map((call) => call[1].progress)).toEqual(["start", "finish"]);
        expect(h.productDbFetch).not.toHaveBeenCalled();
        expect(h.productDbCompare).not.toHaveBeenCalled();
        expect(h.updateFlush).not.toHaveBeenCalled();
    });

    it("reports an error and exits 1 when the run config cannot be fetched/validated", async () => {
        const h = makeService({ configFailure: true });
        const exit = await h.service.run();

        expect(exit).toBe(1);
        expect(h.reportProgress.mock.calls.map((call) => call[1].progress)).toEqual(["start", "error"]);
        expect(h.reportProgress.mock.calls[1][1]).toMatchObject({
            progress: "error",
            error: expect.stringContaining("config exploded") as string,
        });
    });

});
