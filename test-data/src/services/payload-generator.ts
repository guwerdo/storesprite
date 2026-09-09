import fs from 'node:fs';
import path from 'node:path';
import type { MappedProduct, SupplierFeedDef, SupplierMappingConfig } from '../models/types.js';
import { CsvParserService } from './csv-parser-service.js';
import { XmlBuilderService } from './xml-builder-service.js';

export const SUPPLIER_FEEDS: SupplierFeedDef[] = [
  { name: 'cromwell', csvFileName: 'cromwell.csv', mappingFileName: 'cromwell-mapping.json' },
  { name: 'depiend', csvFileName: 'depiend.csv', mappingFileName: 'depiend-mapping.json' },
  { name: 'madalbal', csvFileName: 'madalbal.csv', mappingFileName: 'madalbal-mapping.json' },
  { name: 'magictools', csvFileName: 'magictools.csv', mappingFileName: 'magictools-mapping.json' },
  { name: 'stanley', csvFileName: 'stanley.csv', mappingFileName: 'stanley-mapping.json' }
];

export interface GenerationResult {
  totalProducts: number;
  supplierCounts: Record<string, number>;
  outputFilePath: string;
}

export class PayloadGenerator {
  private readonly _csvParser: CsvParserService;
  private readonly _xmlBuilder: XmlBuilderService;

  constructor(csvParser?: CsvParserService, xmlBuilder?: XmlBuilderService) {
    this._csvParser = csvParser ?? new CsvParserService();
    this._xmlBuilder = xmlBuilder ?? new XmlBuilderService();
  }

  public run(options?: {
    csvDir?: string;
    outputXmlPath?: string;
    feeds?: SupplierFeedDef[];
    warehouseMap?: Map<string, string>;
  }): GenerationResult {
    const csvDir = options?.csvDir ?? this.resolveDefaultCsvDir();
    const outputXmlPath = options?.outputXmlPath ?? this.resolveDefaultOutputDir();
    const feeds = options?.feeds ?? SUPPLIER_FEEDS;
    const warehouseMap = options?.warehouseMap;

    console.log(`[PayloadGenerator] Loading supplier feeds from: ${csvDir}`);
    const allProducts: MappedProduct[] = [];
    const supplierCounts: Record<string, number> = {};

    for (const feed of feeds) {
      const csvPath = path.join(csvDir, feed.csvFileName);
      const mappingPath = this.resolveMappingPath(csvDir, feed.mappingFileName);

      if (!fs.existsSync(csvPath)) {
        console.warn(`[PayloadGenerator] Warning: CSV not found for ${feed.name}: ${csvPath}`);
        continue;
      }
      if (!fs.existsSync(mappingPath)) {
        console.warn(`[PayloadGenerator] Warning: Mapping JSON not found for ${feed.name}: ${mappingPath}`);
        continue;
      }

      const mappingRaw = fs.readFileSync(mappingPath, { encoding: 'utf-8' });
      const mappingConfig: SupplierMappingConfig = JSON.parse(mappingRaw);

      if (warehouseMap) {
        mappingConfig.stocks = mappingConfig.stocks.map((s) => ({
          ...s,
          warehouse: warehouseMap.get(s.warehouse) ?? s.warehouse
        }));
      }

      const products = this._csvParser.parseSupplierCsv(csvPath, mappingConfig);
      supplierCounts[feed.name] = products.length;
      allProducts.push(...products);

      console.log(`[PayloadGenerator] -> Loaded ${products.length} products from ${feed.name} (${feed.csvFileName})`);
    }

    console.log(`[PayloadGenerator] Total products combined: ${allProducts.length}`);

    const xmlContent = this._xmlBuilder.buildPayloadXml(allProducts);

    const outDir = path.dirname(outputXmlPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outputXmlPath, xmlContent, { encoding: 'utf-8' });
    console.log(`[PayloadGenerator] Successfully generated UNAS payload XML at: ${outputXmlPath}`);

    return {
      totalProducts: allProducts.length,
      supplierCounts,
      outputFilePath: outputXmlPath
    };
  }

  public resolveDefaultCsvDir(): string {
    const candidates = [
      path.resolve(process.cwd(), 'csv'),
      path.resolve(process.cwd(), 'test-data', 'csv'),
      path.resolve('/workspace/csv')
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.resolve(process.cwd(), 'csv');
  }

  public resolveDefaultOutputDir(): string {
    const candidates = [
      path.resolve(process.cwd(), 'xml', 'payload.xml'),
      path.resolve(process.cwd(), 'test-data', 'xml', 'payload.xml'),
      path.resolve('/workspace/xml/payload.xml')
    ];

    for (const candidate of candidates) {
      const dir = path.dirname(candidate);
      if (fs.existsSync(dir)) {
        return candidate;
      }
    }

    return path.resolve(process.cwd(), 'xml', 'payload.xml');
  }

  public resolveMappingPaths(csvDir: string, feeds: SupplierFeedDef[] = SUPPLIER_FEEDS): string[] {
    return feeds.map((feed) => this.resolveMappingPath(csvDir, feed.mappingFileName));
  }

  private resolveMappingPath(csvDir: string, defaultMappingName: string): string {
    const directPath = path.join(csvDir, defaultMappingName);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    // Fallback if depoend vs depiend
    if (defaultMappingName === 'depiend-mapping.json') {
      const altPath = path.join(csvDir, 'depoend-mapping.json');
      if (fs.existsSync(altPath)) {
        return altPath;
      }
    }

    return directPath;
  }
}
