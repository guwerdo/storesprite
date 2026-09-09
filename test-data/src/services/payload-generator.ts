import fs from 'node:fs';
import path from 'node:path';
import type { ISetProduct, IUnasJsonClient } from '@storesprite/unas-json-client';
import type { MappedProduct, SupplierFeedDef, SupplierMappingConfig } from '../models/types.js';
import { CsvParserService } from './csv-parser-service.js';

export const SUPPLIER_FEEDS: SupplierFeedDef[] = [
  { name: 'cromwell', csvFileName: 'cromwell.csv', mappingFileName: 'cromwell-mapping.json' },
  { name: 'depiend', csvFileName: 'depiend.csv', mappingFileName: 'depiend-mapping.json' },
  { name: 'madalbal', csvFileName: 'madalbal.csv', mappingFileName: 'madalbal-mapping.json' },
  { name: 'magictools', csvFileName: 'magictools.csv', mappingFileName: 'magictools-mapping.json' },
  { name: 'stanley', csvFileName: 'stanley.csv', mappingFileName: 'stanley-mapping.json' },
];

export interface GenerationResult {
  totalProducts: number;
  supplierCounts: Record<string, number>;
  products: ISetProduct[];
}

export class PayloadGenerator {
  private readonly _csvParser: CsvParserService;

  constructor(csvParser?: CsvParserService) {
    this._csvParser = csvParser ?? new CsvParserService();
  }

  public run(options?: {
    csvDir?: string;
    feeds?: SupplierFeedDef[];
    warehouseMap?: Map<string, string>;
  }): GenerationResult {
    const csvDir = options?.csvDir ?? this.resolveDefaultCsvDir();
    const feeds = options?.feeds ?? SUPPLIER_FEEDS;
    const warehouseMap = options?.warehouseMap;

    console.log(`[PayloadGenerator] Loading supplier feeds from: ${csvDir}`);
    const allProducts: ISetProduct[] = [];
    const supplierCounts: Record<string, number> = {};

    for (const feed of feeds) {
      const csvPath = path.join(csvDir, feed.csvFileName);
      const mappingPath = this.resolveMappingPath(csvDir, feed.mappingFileName);

      if (!fs.existsSync(csvPath) || !fs.existsSync(mappingPath)) {
        continue;
      }

      const mappingRaw = fs.readFileSync(mappingPath, { encoding: 'utf-8' });
      const mappingConfig: SupplierMappingConfig = JSON.parse(mappingRaw);

      if (warehouseMap) {
        mappingConfig.stocks = mappingConfig.stocks.map((s) => ({
          ...s,
          warehouse: warehouseMap.get(s.warehouse) ?? s.warehouse,
        }));
      }

      const rawProducts: MappedProduct[] = this._csvParser.parseSupplierCsv(csvPath, mappingConfig);
      supplierCounts[feed.name] = rawProducts.length;

      const convertedProducts: ISetProduct[] = rawProducts.map((p) => ({
        sku: p.sku,
        action: 'add',
        name: p.title || undefined,
        description: p.description || undefined,
        categories: p.category !== undefined ? [{ id: p.category, type: 'base' }] : undefined,
        stocks: p.stocks.map((s) => ({
          warehouseId: s.warehouseId,
          quantity: Number(s.qty),
          isActive: true,
        })),
        prices: {
          vat: '27%',
          prices: [{ type: 'normal', net: 100, gross: 200, actual: 1 }],
        },
      }));

      allProducts.push(...convertedProducts);
      console.log(`[PayloadGenerator] -> Loaded ${convertedProducts.length} products from ${feed.name}`);
    }

    console.log(`[PayloadGenerator] Total products prepared: ${allProducts.length}`);

    return {
      totalProducts: allProducts.length,
      supplierCounts,
      products: allProducts,
    };
  }

  public async uploadProducts(
    client: IUnasJsonClient,
    products: ISetProduct[],
    batchSize: number = 100,
  ): Promise<{ successCount: number; errorCount: number }> {
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const chunk = products.slice(i, i + batchSize);
      console.log(`[PayloadGenerator] Uploading batch ${Math.floor(i / batchSize) + 1} (${chunk.length} products)...`);
      try {
        const responses = await client.setProduct({ products: chunk });
        for (const resp of responses) {
          if (resp.status === 'ok') {
            successCount++;
          } else {
            errorCount++;
          }
        }
      } catch (err) {
        console.error(`[PayloadGenerator] Error uploading batch starting at index ${i}:`, err);
        errorCount += chunk.length;
      }
    }

    return { successCount, errorCount };
  }

  public resolveDefaultCsvDir(): string {
    const candidates = [
      path.resolve(process.cwd(), 'csv'),
      path.resolve(process.cwd(), 'test-data', 'csv'),
      path.resolve('/workspace/csv'),
      path.resolve('/workspace/test-data/csv'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.resolve(process.cwd(), 'csv');
  }

  public resolveMappingPaths(csvDir: string, feeds: SupplierFeedDef[] = SUPPLIER_FEEDS): string[] {
    return feeds.map((feed) => this.resolveMappingPath(csvDir, feed.mappingFileName));
  }

  private resolveMappingPath(csvDir: string, defaultMappingName: string): string {
    const directPath = path.join(csvDir, defaultMappingName);
    if (fs.existsSync(directPath)) {
      return directPath;
    }
    if (defaultMappingName === 'depiend-mapping.json') {
      const altPath = path.join(csvDir, 'depoend-mapping.json');
      if (fs.existsSync(altPath)) {
        return altPath;
      }
    }
    return directPath;
  }
}
