import { inject, injectable } from "inversify";
import axios from "axios";
import type { Readable } from "node:stream";
import csv from "csv-parser";
import stripBomStream from "strip-bom-stream";
import type { Logger } from "log4js";
import type { IUnasJsonClient } from "@storesprite/unas-json-client";
import { TYPES } from "../types/binding-keys.js";
import type { IUnasProductRow } from "../types/unas-product.interface.js";
import type { WarehouseDto } from "../types/mapping.interface.js";
import type { ProductUpdate, RunCounters } from "../types/connection.interface.js";
import { UnasCsvColumnNames } from "../config/unas-csv-column-names.js";
import { ConnectionIndexRepository } from "../repository/connection-index.repository.js";
import { computeFinalStocks, stocksEqual, toStockArray } from "../utils/mapping-util.js";

/** UNAS disables a product's stock rows with the exact literal "off". */
const UNAS_STOCK_OFF = "off";

/**
 * Parses a single UNAS stock cell. An empty/whitespace cell and a non-numeric
 * cell both mean "no usable value" → undefined (never throws), mirroring the
 * legacy mapper's behaviour but reporting instead of aborting the run.
 */
function parseStockNumber(value: unknown): number | undefined {
    if (value == null) {
        return undefined;
    }
    if (typeof value === "number") {
        return Number.isNaN(value) ? undefined : value;
    }
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed === "") {
        return undefined;
    }
    const number = Number(trimmed);
    if (Number.isNaN(number)) {
        return undefined;
    }
    return number;
}

/**
 * Stage 2: stream the UNAS product-database CSV (comma-delimited), reverse-join
 * each row against the supplier index and emit the diffed updates. The UNAS DB
 * is never materialized — rows are looked up and dropped as they stream by.
 */
@injectable()
export class UnasProductDbService {
    constructor(
        @inject(TYPES.Logger) private readonly _logger: Logger,
        @inject(ConnectionIndexRepository) private readonly _index: ConnectionIndexRepository
    ) {}

    /** Asks UNAS for the downloadable product-DB CSV URL. */
    public async fetchProductDbUrl(client: IUnasJsonClient): Promise<string> {
        this._logger.info("Requesting UNAS product-database export URL");
        return client.getProductDB({ format: "csv", getParam: false, getStock: true, getData: false });
    }

    /** Opens the export URL as a stream of parsed CSV rows (UNAS comma format). */
    public async openDbStream(url: string): Promise<AsyncIterable<Record<string, unknown>>> {
        this._logger.info("Downloading UNAS product-database CSV", { url });
        const response = await axios.get<Readable>(url, { responseType: "stream", timeout: 120_000 });
        return response.data.pipe(stripBomStream()).pipe(csv());
    }

    /**
     * One UNAS row → the product's current warehouse stock. Returns null when
     * the SKU column is empty (nothing can be matched). Main-warehouse stock is
     * "off" → empty set; a non-numeric main/additional cell is logged and that
     * warehouse is skipped rather than failing the run.
     */
    public parseProductRow(row: Record<string, unknown>, warehouses: WarehouseDto[]): IUnasProductRow | null {
        const rawSku = row[UnasCsvColumnNames.sku];
        const sku = typeof rawSku === "string" ? rawSku.trim() : undefined;
        if (!sku) {
            return null;
        }
        const stocks = new Map<number, number>();

        const mainCell = row[UnasCsvColumnNames.stockMain];
        if (mainCell === UNAS_STOCK_OFF) {
            // Product disabled on UNAS → treat as "no current stock anywhere".
            return { sku, stocks };
        }
        const mainQuantity = parseStockNumber(mainCell);
        if (mainQuantity === undefined) {
            this._logger.warn("Non-numeric or empty main stock cell (Raktárkészlet)", { sku });
        } else {
            stocks.set(1, mainQuantity);
        }

        for (const warehouse of warehouses) {
            if (warehouse.id === 1) {
                continue; // main warehouse 1 is Raktárkészlet, never a "További" column
            }
            const column = UnasCsvColumnNames.stockAdditionalPrefix + warehouse.name;
            const cell = row[column];
            if (cell === undefined) {
                this._logger.warn("Additional stock column missing from UNAS export", {
                    sku,
                    warehouse: warehouse.name,
                    column,
                });
                continue;
            }
            const quantity = parseStockNumber(cell);
            if (quantity === undefined) {
                this._logger.warn("Non-numeric additional stock cell", { sku, warehouse: warehouse.name });
                continue;
            }
            stocks.set(warehouse.id, quantity);
        }
        return { sku, stocks };
    }

    /**
     * Streams the UNAS CSV, diffs against the supplier index and calls
     * `onUpdate` for every product whose *final* (zeroed) stock differs from the
     * current one. Matched SKUs are removed from the index as they are seen;
     * anything left over afterwards never appeared in the UNAS DB (warned).
     */
    public async streamAndCompare(
        rows: AsyncIterable<Record<string, unknown>>,
        warehouses: WarehouseDto[],
        counters: RunCounters,
        onUpdate: (update: ProductUpdate) => Promise<void>
    ): Promise<void> {
        let rowCount = 0;
        for await (const row of rows) {
            rowCount += 1;
            const product = this.parseProductRow(row, warehouses);
            if (product === null) {
                continue;
            }
            const entries = this._index.get(product.sku);
            if (!entries) {
                continue; // SKU not in the supplier feed → never touch it
            }
            for (const entry of entries) {
                const finalStocks = computeFinalStocks(product.stocks, entry.desired);
                if (stocksEqual(finalStocks, product.stocks)) {
                    counters.unchangedItems += 1;
                    continue;
                }
                await onUpdate({ sku: product.sku, stocks: toStockArray(finalStocks) });
            }
            this._index.delete(product.sku);
        }

        if (this._index.size > 0) {
            for (const sku of [...this._index.keys()]) {
                counters.warningCount += 1;
                this._logger.warn("Supplier SKU absent from UNAS product database", { sku });
            }
            this._index.clear();
        }

        this._logger.info("UNAS product database streamed and compared", { rowCount, ...counters });
    }
}
