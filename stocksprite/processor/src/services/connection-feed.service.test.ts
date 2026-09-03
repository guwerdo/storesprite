import { describe, expect, it, vi } from "vitest";
import type { Logger } from "log4js";
import type { MappingDto } from "../types/mapping.interface.js";
import { ConnectionIndexRepository } from "../repository/connection-index.repository.js";
import { RuleTransformService } from "./rule-transform.service.js";
import { ConnectionFeedService } from "./connection-feed.service.js";

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

function asyncRows(rows: Record<string, unknown>[]): AsyncIterable<Record<string, unknown>> {
    return (async function* () {
        for (const row of rows) {
            await Promise.resolve();
            yield row;
        }
    })();
}

const mapping: MappingDto = {
    id: "m1",
    connectionId: "conn-1",
    skuField: "SKU",
    skuRules: [{ op: "replace-all", params: { from: "-", to: "" } }],
    stockMappings: [
        { column: "Raktár", warehouseId: 1 },
        { column: "BP", warehouseId: 2 },
        { column: "Debrecen", warehouseId: 3, rules: [{ op: "multiply", params: { value: 2 } }] },
    ],
};

describe("ConnectionFeedService", () => {
    describe("desiredForRow", () => {
        it("maps one row to its desired stock state (rules + empty-cell→0)", () => {
            const service = new ConnectionFeedService(stubLogger(), new ConnectionIndexRepository(), new RuleTransformService());
            const match = service.desiredForRow(
                { SKU: "A-100", Raktár: "5", BP: "", Debrecen: "3" },
                mapping
            );
            expect(match).toBeDefined();
            expect(match?.sku).toBe("A100");
            expect([...(match?.desired ?? [])]).toEqual([
                [1, 5],
                [2, 0],
                [3, 6],
            ]);
        });

        it("returns undefined when the SKU resolves empty", () => {
            const service = new ConnectionFeedService(stubLogger(), new ConnectionIndexRepository(), new RuleTransformService());
            expect(service.desiredForRow({ SKU: "", Raktár: "1" }, mapping)).toBeUndefined();
            expect(service.desiredForRow({ SKU: "   ", Raktár: "1" }, mapping)).toBeUndefined();
        });
    });

    describe("buildIndexFromRows", () => {
        it("indexes each row, appending duplicates in order", async () => {
            const index = new ConnectionIndexRepository();
            const service = new ConnectionFeedService(stubLogger(), index, new RuleTransformService());
            const rows = [
                { SKU: "A-100", Raktár: "5", BP: "", Debrecen: "3" },
                { SKU: "A100", Raktár: "", BP: "2", Debrecen: "0" },
            ];
            const result = await service.buildIndexFromRows(asyncRows(rows), mapping);

            expect(result.processedItems).toBe(2);
            expect(result.skippedEmptySkus).toBe(0);
            const states = index.get("A100");
            expect(states).toHaveLength(2);
            expect([...(states?.[0] ?? [])]).toEqual([
                [1, 5],
                [2, 0],
                [3, 6],
            ]);
            expect([...(states?.[1] ?? [])]).toEqual([
                [1, 0],
                [2, 2],
                [3, 0],
            ]);
        });

        it("skips rows whose SKU is empty and counts them", async () => {
            const index = new ConnectionIndexRepository();
            const service = new ConnectionFeedService(stubLogger(), index, new RuleTransformService());
            const rows = [
                { SKU: "A100", Raktár: "1", BP: "", Debrecen: "0" },
                { SKU: "", Raktár: "1", BP: "", Debrecen: "0" },
                { SKU: "   ", Raktár: "1", BP: "", Debrecen: "0" },
            ];
            const result = await service.buildIndexFromRows(asyncRows(rows), mapping);

            expect(result.processedItems).toBe(3);
            expect(result.skippedEmptySkus).toBe(2);
            expect(index.size).toBe(1);
        });

        it("handles an empty feed (no rows)", async () => {
            const service = new ConnectionFeedService(stubLogger(), new ConnectionIndexRepository(), new RuleTransformService());
            const result = await service.buildIndexFromRows(asyncRows([]), mapping);
            expect(result.processedItems).toBe(0);
            expect(result.skippedEmptySkus).toBe(0);
        });
    });
});
