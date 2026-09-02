import { describe, expect, it, vi } from "vitest";
import type { Logger } from "log4js";
import { UnasHttpError } from "@storesprite/unas-json-client";
import type { IUnasJsonClient, ISetProduct, ISetProductResponse } from "@storesprite/unas-json-client";
import { createRunCounters, type RunCounters } from "../types/connection.interface.js";
import { UnasUpdateService } from "./unas-update.service.js";

// Keep 429-retry unit tests fast: the real backoff (2s / 4s) never runs here.
vi.mock("../utils/http-util.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../utils/http-util.js")>();
    return { ...actual, delay: vi.fn().mockResolvedValue(undefined) };
});

type SetProductHandler = (request: { products: ISetProduct[] }) => Promise<ISetProductResponse[]>;
type SetProductMock = ReturnType<typeof vi.fn<SetProductHandler>>;

function stubLogger(): Logger {
    return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        mark: vi.fn(),
    } as unknown as Logger;
}

function rateLimit(): UnasHttpError {
    return new UnasHttpError("Too Many Requests", 429, "http://unas/setProduct");
}

function okResponses(products: ISetProduct[]): ISetProductResponse[] {
    return products.map((product) => ({ id: product.sku, sku: product.sku, action: "modify", status: "ok" as const }));
}

function makeProduct(sku: string): ISetProduct {
    return { sku, stocks: [{ quantity: 1 }] };
}

function makeHarness(setProduct: SetProductMock): { service: UnasUpdateService; counters: RunCounters; setProduct: SetProductMock } {
    const service = new UnasUpdateService(stubLogger());
    const client = {
        login: vi.fn(),
        getProductDB: vi.fn(),
        getWarehouse: vi.fn(),
        setProduct,
    } as unknown as IUnasJsonClient;
    service.setClient(client);
    return { service, counters: createRunCounters(), setProduct };
}

describe("UnasUpdateService", () => {
    it("flushes at 100 and again when the run is finished", async () => {
        const setProduct = vi.fn<SetProductHandler>((request) => Promise.resolve(okResponses(request.products)));
        const { service, counters } = makeHarness(setProduct);

        const products = Array.from({ length: 105 }, (_, i) => makeProduct(`S${i}`));
        for (const product of products) {
            await service.queue(product, counters);
        }
        await service.flush(counters);

        expect(setProduct).toHaveBeenCalledTimes(2);
        expect(setProduct.mock.calls[0][0].products).toHaveLength(100);
        expect(setProduct.mock.calls[1][0].products).toHaveLength(5);
        expect(counters.updatedItems).toBe(105);
        expect(counters.errorCount).toBe(0);
    });

    it("never sends more than 100 products in one chunk", async () => {
        const setProduct = vi.fn<SetProductHandler>((request) => Promise.resolve(okResponses(request.products)));
        const { service, counters } = makeHarness(setProduct);

        const products = Array.from({ length: 250 }, (_, i) => makeProduct(`S${i}`));
        for (const product of products) {
            await service.queue(product, counters);
        }
        await service.flush(counters);

        expect(setProduct).toHaveBeenCalledTimes(3);
        expect(setProduct.mock.calls.map((call) => call[0].products.length)).toEqual([100, 100, 50]);
        expect(counters.updatedItems).toBe(250);
    });

    it("tallies per-product status:error as a partial error without aborting", async () => {
        const setProduct = vi.fn<SetProductHandler>((request) =>
            Promise.resolve(
                request.products.map((product) =>
                    product.sku === "BAD"
                        ? { id: "id-bad", sku: product.sku, action: "modify", status: "error" as const }
                        : { id: product.sku, sku: product.sku, action: "modify", status: "ok" as const }
                )
            )
        );
        const { service, counters } = makeHarness(setProduct);

        await service.queue(makeProduct("OK-1"), counters);
        await service.queue(makeProduct("BAD"), counters);
        await service.flush(counters);

        expect(counters.updatedItems).toBe(2);
        expect(counters.errorCount).toBe(1);
    });

    it("warns when UNAS returns an empty / mismatched response", async () => {
        const setProduct = vi.fn<SetProductHandler>(() => Promise.resolve([]));
        const { service, counters } = makeHarness(setProduct);

        await service.queue(makeProduct("S1"), counters);
        await service.flush(counters);

        expect(counters.updatedItems).toBe(1);
        expect(counters.warningCount).toBe(1);
        expect(counters.errorCount).toBe(0);
    });

    it("retries a chunk on HTTP 429 (2 retries) and succeeds", async () => {
        const setProduct = vi.fn<SetProductHandler>();
        setProduct.mockRejectedValueOnce(rateLimit());
        setProduct.mockRejectedValueOnce(rateLimit());
        setProduct.mockImplementation((request) => Promise.resolve(okResponses(request.products)));
        const { service, counters } = makeHarness(setProduct);

        await service.queue(makeProduct("S1"), counters);
        await service.flush(counters);

        expect(setProduct).toHaveBeenCalledTimes(3);
        expect(counters.warningCount).toBe(2);
        expect(counters.updatedItems).toBe(1);
    });

    it("fails fatally when UNAS keeps answering 429 after all retries", async () => {
        const setProduct = vi.fn<SetProductHandler>();
        setProduct.mockRejectedValue(rateLimit());
        const { service, counters } = makeHarness(setProduct);

        await service.queue(makeProduct("S1"), counters);
        await expect(service.flush(counters)).rejects.toThrow();
        expect(counters.warningCount).toBe(2);
        expect(counters.updatedItems).toBe(0);
    });

    it("rejects when a buffered send has no client attached", async () => {
        const service = new UnasUpdateService(stubLogger());
        const counters = createRunCounters();
        await service.queue(makeProduct("S1"), counters);
        await expect(service.flush(counters)).rejects.toThrow(/not been attached/);
    });

    it("flush with an empty buffer is a no-op", async () => {
        const setProduct = vi.fn<SetProductHandler>();
        const { service, counters } = makeHarness(setProduct);
        await service.flush(counters);
        expect(setProduct).not.toHaveBeenCalled();
    });
});
