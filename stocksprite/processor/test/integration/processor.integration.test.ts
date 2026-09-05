import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Logger } from "log4js";
import { mock } from "vitest-mock-extended";
import { createUnasJsonClient } from "@storesprite/unas-json-client";
import type { MappingRule, StockMappingItem } from "@storesprite/mapping-rules";
import type { AppConfig } from "../../src/config/app.config.js";
import { RuleTransformService } from "../../src/services/rule-transform.service.js";
import { ConnectionFeedService } from "../../src/services/connection-feed.service.js";
import { UnasProductDbService } from "../../src/services/unas-product-db.service.js";
import { UnasUpdateService } from "../../src/services/unas-update.service.js";
import { ProcessorService } from "../../src/services/processor.service.js";
import type { IBackendApiClient } from "../../src/services/backend-api-client.js";
import { ConnectionIndexRepository } from "../../src/repository/connection-index.repository.js";
import type { MappingDto, ProgressBody, RunConfigResponse, WarehouseDto } from "../../src/types/mapping.interface.js";
import { startFakeUnasServer } from "./fake-unas-server.js";

/**
 * End-to-end CSV → XML scenarios. Every scenario runs the REAL processor wiring:
 * real CSV parsing (csv-parser + strip-bom-stream + fs), the REAL
 * @storesprite/unas-json-client over real HTTP against the in-process fake UNAS
 * server, and only the backend client is mocked. The captured setProduct XML is
 * diffed against a golden fixture (one scenario = 2 input CSVs + 1 golden XML).
 */

const FIXTURES_DIR = path.resolve(process.cwd(), "test", "integration", "fixtures");

const MAIN_WAREHOUSE: WarehouseDto = { id: 1, name: "Fő raktár", publicName: "Fő raktár" };
const WAREHOUSES: WarehouseDto[] = [
    MAIN_WAREHOUSE,
    { id: 2, name: "BP", publicName: "Budapest" },
    { id: 3, name: "Debrecen", publicName: "Debrecen" },
];

const replaceDash: MappingRule = { op: "replace-all", params: { from: "-", to: "" } };
const multiplyBy3: MappingRule = { op: "multiply", params: { value: 3 } };
const averageDash: MappingRule = { op: "average", params: { separator: "-" } };

function readFixture(fileName: string): string {
    return readFileSync(path.join(FIXTURES_DIR, fileName), "utf8");
}

/** Collapses the XML the way the real client builds it (minified, one prolog). */
function normalizeXml(xml: string): string {
    return xml.replace(/<\?xml[^>]*\?>\s*/g, "").replace(/>\s+</g, "><").trim();
}

function countTags(xml: string, tag: string): number {
    return (xml.match(new RegExp(`<${tag}>`, "g")) ?? []).length;
}

interface Scenario {
    name: string;
    connectionId: string;
    mapping: MappingDto;
    warehouses: WarehouseDto[];
    /** Fake server answers this SKU with status:error (all others ok). */
    errorSku?: string;
    /** Golden fixture file to diff against (absent → expect zero setProduct bodies). */
    golden?: string;
    expectExit: number;
    /** Asserted against the final `finish` progress body (partial match). */
    expectFinish: Partial<ProgressBody>;
}

function fullStockMappings(): StockMappingItem[] {
    return [
        { column: "Main", warehouseId: 1 },
        { column: "BP", warehouseId: 2 },
        { column: "Debrecen", warehouseId: 3 },
    ];
}

const scenarios: Scenario[] = [
    {
        name: "happy-path",
        connectionId: "conn-happy",
        mapping: {
            id: "mapping-happy",
            connectionId: "conn-happy",
            skuField: "SKU",
            skuRules: [replaceDash],
            stockMappings: [
                { column: "Main", warehouseId: 1 },
                { column: "BP", warehouseId: 2, rules: [multiplyBy3] },
                { column: "Interval", warehouseId: 3, rules: [averageDash] },
            ],
        },
        warehouses: WAREHOUSES,
        golden: "happy-path.expected.xml",
        expectExit: 0,
        expectFinish: { processedItems: 2, updatedItems: 2, unchangedItems: 0, errorCount: 0 },
    },
    {
        name: "zeroout",
        connectionId: "conn-zeroout",
        mapping: {
            id: "mapping-zeroout",
            connectionId: "conn-zeroout",
            skuField: "SKU",
            skuRules: [],
            stockMappings: [{ column: "BP", warehouseId: 2 }],
        },
        warehouses: WAREHOUSES,
        golden: "zeroout.expected.xml",
        expectExit: 0,
        expectFinish: { processedItems: 1, updatedItems: 1, unchangedItems: 0, errorCount: 0 },
    },
    {
        name: "partial",
        connectionId: "conn-partial",
        mapping: {
            id: "mapping-partial",
            connectionId: "conn-partial",
            skuField: "SKU",
            skuRules: [],
            stockMappings: fullStockMappings(),
        },
        warehouses: WAREHOUSES,
        errorSku: "E1",
        golden: "partial.expected.xml",
        expectExit: 1,
        expectFinish: { processedItems: 2, updatedItems: 2, unchangedItems: 0, errorCount: 1 },
    },
    {
        name: "noop",
        connectionId: "conn-noop",
        mapping: {
            id: "mapping-noop",
            connectionId: "conn-noop",
            skuField: "SKU",
            skuRules: [],
            stockMappings: fullStockMappings(),
        },
        warehouses: WAREHOUSES,
        expectExit: 0,
        expectFinish: { processedItems: 1, updatedItems: 0, unchangedItems: 1, errorCount: 0 },
    },
    {
        name: "skip",
        connectionId: "conn-skip",
        mapping: {
            id: "mapping-skip",
            connectionId: "conn-skip",
            skuField: "SKU",
            skuRules: [],
            stockMappings: fullStockMappings(),
        },
        warehouses: WAREHOUSES,
        expectExit: 0,
        expectFinish: { processedItems: 1, updatedItems: 0, unchangedItems: 0, errorCount: 0, warningCount: 1 },
    },
    {
        name: "sku-conversion",
        connectionId: "conn-sku-conversion",
        mapping: {
            id: "mapping-sku-conversion",
            connectionId: "conn-sku-conversion",
            skuField: "SKU",
            skuRules: [],
            stockMappings: [{ column: "Main", warehouseId: 1 }],
        },
        warehouses: [MAIN_WAREHOUSE],
        golden: "sku-conversion.expected.xml",
        expectExit: 0,
        expectFinish: {
            processedItems: 3,
            updatedItems: 3,
            unchangedItems: 0,
            errorCount: 0,
            skuNormalizations: {
                converted: {
                    count: 3,
                    examples: [
                        { before: "123.ASD", after: "123_ASD" },
                        { before: "A B", after: "A_B" },
                        { before: "C##D", after: "C__D" },
                    ],
                },
                truncated: { count: 0, examples: [] },
            },
        },
    },
];

interface RunOutcome {
    exit: number;
    bodies: ProgressBody[];
    sends: string[];
}

async function runScenario(scenario: Scenario, csvOverrides?: { connectionCsv?: string; dbCsv?: string }): Promise<RunOutcome> {
    const outputDir = mkdtempSync(path.join(tmpdir(), "processor-int-"));
    const server = await startFakeUnasServer({
        dbCsv: csvOverrides?.dbCsv ?? readFixture(`${scenario.name}.unas-db.csv`),
        productErrorSku: scenario.errorSku,
    });
    try {
        writeFileSync(
            path.join(outputDir, `${scenario.connectionId}.csv`),
            csvOverrides?.connectionCsv ?? readFixture(`${scenario.name}.connection.csv`),
            "utf8"
        );

        const logger = mock<Logger>();
        const runConfig: RunConfigResponse = {
            mapping: scenario.mapping,
            unasConfig: { baseUrl: server.baseUrl, apiKey: "integration-api-key" },
            warehouses: scenario.warehouses,
        };

        const bodies: ProgressBody[] = [];
        const backend: IBackendApiClient = {
            getRunConfig: () => Promise.resolve(runConfig),
            reportProgress: (_mappingId, body) => {
                bodies.push(body);
                return Promise.resolve();
            },
        };

        const index = new ConnectionIndexRepository();
        const feed = new ConnectionFeedService(logger, index, new RuleTransformService());
        const productDb = new UnasProductDbService(logger, index);
        const update = new UnasUpdateService(logger);

        const config: AppConfig = {
            mappingId: scenario.mapping.id,
            runId: `run-${scenario.name}`,
            internalToken: "integration-token",
            backendUrl: "http://storesprite-be.invalid",
            outputDir,
        };
        const service = new ProcessorService(config, logger, backend, createUnasJsonClient, index, feed, productDb, update);

        const exit = await service.run();
        return { exit, bodies, sends: [...server.setProductBodies] };
    } finally {
        await server.close();
        rmSync(outputDir, { recursive: true, force: true });
    }
}

describe("processor → UNAS CSV-to-XML integration", () => {
    it.each(scenarios)("$name: supplier CSV + UNAS DB produce the golden setProduct XML", async (scenario) => {
        const { exit, bodies, sends } = await runScenario(scenario);

        expect(exit).toBe(scenario.expectExit);
        expect(bodies.map((body) => body.progress)).toEqual(["start", "parse", "download", "compare", "finish"]);

        if (scenario.golden) {
            expect(sends).toHaveLength(1);
            expect(normalizeXml(sends[0])).toBe(normalizeXml(readFixture(scenario.golden)));
        } else {
            expect(sends).toHaveLength(0);
        }

        const finish = bodies[bodies.length - 1];
        expect(finish).toMatchObject({ progress: "finish", ...scenario.expectFinish });
    });

    it("batches more than 100 diffs into multiple ≤100 setProduct calls", async () => {
        const count = 105;
        const rows = Array.from({ length: count }, (_, i) => {
            const sku = `S${String(i + 1).padStart(3, "0")}`;
            return { sku, row: `${sku};7`, dbRow: `${sku},0` };
        });
        const connectionCsv = ["SKU;Main", ...rows.map((r) => r.row)].join("\n");
        const dbCsv = ["Cikkszám,Raktárkészlet", ...rows.map((r) => r.dbRow)].join("\n");

        const scenario: Scenario = {
            name: "batch",
            connectionId: "conn-batch",
            mapping: {
                id: "mapping-batch",
                connectionId: "conn-batch",
                skuField: "SKU",
                skuRules: [],
                stockMappings: [{ column: "Main", warehouseId: 1 }],
            },
            warehouses: [MAIN_WAREHOUSE],
            expectExit: 0,
            expectFinish: { processedItems: count, updatedItems: count, unchangedItems: 0, errorCount: 0 },
        };

        const { exit, bodies, sends } = await runScenario(scenario, { connectionCsv, dbCsv });

        expect(exit).toBe(0);
        expect(bodies.map((body) => body.progress)).toEqual(["start", "parse", "download", "compare", "finish"]);
        expect(sends).toHaveLength(2);
        expect(countTags(sends[0], "Sku")).toBe(100);
        expect(countTags(sends[1], "Sku")).toBe(5);

        const allSkus = [...sends.flatMap((body) => [...body.matchAll(/<Sku>([^<]+)<\/Sku>/g)].map((m) => m[1]))];
        expect(new Set(allSkus).size).toBe(count);
    });

    it("reports truncated SKU normalizations on the finish body", async () => {
        const long = "Z".repeat(55);
        const truncated = "Z".repeat(50);
        const scenario: Scenario = {
            name: "truncate",
            connectionId: "conn-truncate",
            mapping: {
                id: "mapping-truncate",
                connectionId: "conn-truncate",
                skuField: "SKU",
                skuRules: [],
                stockMappings: [{ column: "Main", warehouseId: 1 }],
            },
            warehouses: [MAIN_WAREHOUSE],
            expectExit: 0,
            expectFinish: {
                processedItems: 1,
                updatedItems: 1,
                unchangedItems: 0,
                errorCount: 0,
                skuNormalizations: {
                    converted: { count: 0, examples: [] },
                    truncated: { count: 1, examples: [long] },
                },
            },
        };

        const { exit, bodies, sends } = await runScenario(scenario, {
            connectionCsv: `SKU;Main\n${long};7`,
            dbCsv: `Cikkszám,Raktárkészlet\n${truncated},0`,
        });

        expect(exit).toBe(0);
        expect(bodies.map((body) => body.progress)).toEqual(["start", "parse", "download", "compare", "finish"]);
        expect(sends).toHaveLength(1);
        expect(normalizeXml(sends[0])).toContain(`<Sku>${truncated}</Sku>`);

        const finish = bodies[bodies.length - 1];
        expect(finish).toMatchObject(scenario.expectFinish);
    });
});
