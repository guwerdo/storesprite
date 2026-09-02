import { describe, expect, it, vi } from "vitest";
import type { Logger } from "log4js";
import { UnasCsvColumnNames } from "../config/unas-csv-column-names.js";
import type { WarehouseDto } from "../types/mapping.interface.js";
import { ConnectionIndexRepository } from "../repository/connection-index.repository.js";
import type { ProductUpdate, RunCounters } from "../types/connection.interface.js";
import { createRunCounters } from "../types/connection.interface.js";
import { UnasProductDbService } from "./unas-product-db.service.js";

function stubLogger(warn: ReturnType<typeof vi.fn> = vi.fn()): Logger {
    return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn,
        error: vi.fn(),
        fatal: vi.fn(),
        mark: vi.fn(),
    } as unknown as Logger;
}

const warehouses: WarehouseDto[] = [
    { id: 1, name: "Fő raktár", publicName: "Fő raktár" },
    { id: 2, name: "BP", publicName: "Budapest" },
    { id: 3, name: "Debrecen", publicName: "Debrecen" },
];

const addCol = (name: string): string => UnasCsvColumnNames.stockAdditionalPrefix + name;

function asyncRows(rows: Record<string, unknown>[]): AsyncIterable<Record<string, unknown>> {
    return (async function* () {
        for (const row of rows) {
            await Promise.resolve();
            yield row;
        }
    })();
}

async function runCompare(
    index: ConnectionIndexRepository,
    rows: Record<string, unknown>[],
    whs: WarehouseDto[] = warehouses
): Promise<{ counters: RunCounters; updates: ProductUpdate[] }> {
    const service = new UnasProductDbService(stubLogger(), index);
    const counters = createRunCounters();
    const updates: ProductUpdate[] = [];
    await service.streamAndCompare(asyncRows(rows), whs, counters, (update) => {
        updates.push(update);
        return Promise.resolve();
    });
    return { counters, updates };
}

describe("UnasProductDbService", () => {
    describe("parseProductRow", () => {
        it("reads main + additional warehouse stock into a map", () => {
            const service = new UnasProductDbService(stubLogger(), new ConnectionIndexRepository());
            const product = service.parseProductRow(
                { Cikkszám: " A1 ", Raktárkészlet: "3", [addCol("BP")]: "2", [addCol("Debrecen")]: "1" },
                warehouses
            );
            expect(product).not.toBeNull();
            expect(product?.sku).toBe("A1");
            expect([...(product?.stocks ?? [])]).toEqual([
                [1, 3],
                [2, 2],
                [3, 1],
            ]);
        });

        it("treats the literal 'off' as an empty (disabled) stock set", () => {
            const service = new UnasProductDbService(stubLogger(), new ConnectionIndexRepository());
            const product = service.parseProductRow(
                { Cikkszám: "A1", Raktárkészlet: "off", [addCol("BP")]: "2" },
                warehouses
            );
            expect(product?.stocks.size).toBe(0);
        });

        it("returns null for an empty SKU", () => {
            const service = new UnasProductDbService(stubLogger(), new ConnectionIndexRepository());
            expect(service.parseProductRow({ Cikkszám: "", Raktárkészlet: "3" }, warehouses)).toBeNull();
        });

        it("logs and skips a non-numeric main-stock cell instead of crashing", () => {
            const warn = vi.fn();
            const service = new UnasProductDbService(stubLogger(warn), new ConnectionIndexRepository());
            const product = service.parseProductRow({ Cikkszám: "A1", Raktárkészlet: "abc" }, warehouses);
            expect(product?.stocks.has(1)).toBe(false);
            expect(warn).toHaveBeenCalled();
        });
    });

    describe("streamAndCompare", () => {
        it("zeroes out current warehouses not requested (main included) and emits the diff", async () => {
            const index = new ConnectionIndexRepository();
            index.add("A1", new Map([[1, 5]]));
            const { counters, updates } = await runCompare(index, [
                { Cikkszám: "A1", Raktárkészlet: "3", [addCol("BP")]: "2", [addCol("Debrecen")]: "1" },
            ]);

            expect(counters.unchangedItems).toBe(0);
            expect(updates).toEqual([
                { sku: "A1", stocks: [{ quantity: 5 }, { warehouseId: 2, quantity: 0 }, { warehouseId: 3, quantity: 0 }] },
            ]);
            expect(index.get("A1")).toBeUndefined();
        });

        it("emits nothing when the final (desired ∪ zeroed) state equals the current one", async () => {
            const index = new ConnectionIndexRepository();
            index.add("B1", new Map([[1, 3], [2, 2], [3, 1]]));
            const { counters, updates } = await runCompare(index, [
                { Cikkszám: "B1", Raktárkészlet: "3", [addCol("BP")]: "2", [addCol("Debrecen")]: "1" },
            ]);

            expect(counters.unchangedItems).toBe(1);
            expect(updates).toEqual([]);
            expect(index.get("B1")).toBeUndefined();
        });

        it("wakes a product disabled with 'off' when the supplier wants stock", async () => {
            const index = new ConnectionIndexRepository();
            index.add("C1", new Map([[1, 4], [2, 0]]));
            const { updates } = await runCompare(index, [
                { Cikkszám: "C1", Raktárkészlet: "off", [addCol("BP")]: "9" },
            ]);

            expect(updates).toEqual([
                { sku: "C1", stocks: [{ quantity: 4 }, { warehouseId: 2, quantity: 0 }] },
            ]);
        });

        it("counts an 'off' product with an empty desired state as unchanged", async () => {
            const index = new ConnectionIndexRepository();
            index.add("C2", new Map());
            const { counters, updates } = await runCompare(index, [
                { Cikkszám: "C2", Raktárkészlet: "off" },
            ]);

            expect(counters.unchangedItems).toBe(1);
            expect(updates).toEqual([]);
        });

        it("never touches products that are absent from the supplier index", async () => {
            const index = new ConnectionIndexRepository();
            const { counters, updates } = await runCompare(index, [
                { Cikkszám: "NOT-IN-FEED", Raktárkészlet: "3", [addCol("BP")]: "1" },
            ]);

            expect(counters.unchangedItems).toBe(0);
            expect(updates).toEqual([]);
            expect(index.size).toBe(0);
        });

        it("warns about and drops supplier SKUs that never appear in the UNAS db", async () => {
            const index = new ConnectionIndexRepository();
            index.add("GHOST", new Map([[1, 1]]));
            const { counters, updates } = await runCompare(index, []);

            expect(counters.warningCount).toBe(1);
            expect(updates).toEqual([]);
            expect(index.size).toBe(0);
        });

        it("skips a warehouse whose additional column is missing from the export", async () => {
            const index = new ConnectionIndexRepository();
            index.add("D1", new Map([[1, 2]]));
            const withSzeged: WarehouseDto[] = [...warehouses, { id: 4, name: "Szeged", publicName: "Szeged" }];
            const warn = vi.fn();
            const service = new UnasProductDbService(stubLogger(warn), index);
            const counters = createRunCounters();
            const updates: ProductUpdate[] = [];

            await service.streamAndCompare(
                asyncRows([{ Cikkszám: "D1", Raktárkészlet: "1", [addCol("BP")]: "0", [addCol("Debrecen")]: "0" }]),
                withSzeged,
                counters,
                (update) => {
                    updates.push(update);
                    return Promise.resolve();
                }
            );

            expect(warn).toHaveBeenCalledWith(
                "Additional stock column missing from UNAS export",
                expect.objectContaining({ warehouse: "Szeged" })
            );
            expect(updates).toEqual([
                { sku: "D1", stocks: [{ quantity: 2 }, { warehouseId: 2, quantity: 0 }, { warehouseId: 3, quantity: 0 }] },
            ]);
        });
    });
});
