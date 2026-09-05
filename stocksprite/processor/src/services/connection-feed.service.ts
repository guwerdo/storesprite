import { inject, injectable } from "inversify";
import { createReadStream } from "node:fs";
import csv from "csv-parser";
import stripBomStream from "strip-bom-stream";
import type { Logger } from "log4js";
import { TYPES } from "../types/binding-keys.js";
import type { MappingDto } from "../types/mapping.interface.js";
import { ConnectionIndexRepository } from "../repository/connection-index.repository.js";
import { RuleTransformService } from "./rule-transform.service.js";
import { createEmptySkuNormalizations } from "../types/connection.interface.js";
import type { SkuNormalizations } from "../types/connection.interface.js";

export interface FeedIndexResult {
    /** Total data rows read (header excluded, empty-SKU rows and duplicates included). */
    processedItems: number;
    /** Rows skipped because the SKU resolved empty. */
    skippedEmptySkus: number;
    /** SKU normalizations applied while parsing (empty shape when none). */
    skuNormalizations: SkuNormalizations;
}

export interface FeedRowMatch {
    sku: string;
    desired: Map<number, number>;
}

/**
 * Stage 1 of the pipeline: parse the supplier (connection) CSV and build the
 * in-memory sku → desired-stock index. The file is semicolon-delimited (the
 * downloader writes it that way). Async iteration keeps the memory bound flat.
 */
@injectable()
export class ConnectionFeedService {
    constructor(
        @inject(TYPES.Logger) private readonly _logger: Logger,
        @inject(ConnectionIndexRepository) private readonly _index: ConnectionIndexRepository,
        @inject(RuleTransformService) private readonly _ruleTransform: RuleTransformService
    ) {}

    /** Maps one supplier row to its desired state. Returns undefined when the SKU is empty. */
    public desiredForRow(
        row: Record<string, unknown>,
        mapping: MappingDto,
        normalizations?: SkuNormalizations
    ): FeedRowMatch | undefined {
        const sku = this._ruleTransform.transformSku(
            row[mapping.skuField],
            mapping.skuRules ?? [],
            normalizations
        );
        if (sku === undefined) {
            return undefined;
        }
        const desired = new Map<number, number>();
        for (const stockMapping of mapping.stockMappings) {
            const quantity = this._ruleTransform.transformStockQuantity(row[stockMapping.column], stockMapping.rules ?? []);
            desired.set(stockMapping.warehouseId, quantity);
        }
        return { sku, desired };
    }

    public async buildIndex(filePath: string, mapping: MappingDto): Promise<FeedIndexResult> {
        const rows = createReadStream(filePath).pipe(stripBomStream()).pipe(csv({ separator: ";" }));
        return this.buildIndexFromRows(rows, mapping);
    }

    public async buildIndexFromRows(
        rows: AsyncIterable<Record<string, unknown>>,
        mapping: MappingDto
    ): Promise<FeedIndexResult> {
        let processedItems = 0;
        let skippedEmptySkus = 0;
        const skuNormalizations = createEmptySkuNormalizations();
        for await (const row of rows) {
            processedItems += 1;
            const match = this.desiredForRow(row, mapping, skuNormalizations);
            if (match === undefined) {
                skippedEmptySkus += 1;
                this._logger.warn("Skipping supplier row: empty SKU", { rowNumber: processedItems });
                continue;
            }
            this._index.add(match.sku, match.desired);
        }
        this._logger.info("Supplier feed parsed", { processedItems, skippedEmptySkus, indexedSkus: this._index.size });
        return { processedItems, skippedEmptySkus, skuNormalizations };
    }
}
