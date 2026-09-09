import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import type { MappedProduct, ProductStock, SupplierMappingConfig } from '../models/types.js';

export class CsvParserService {
  public parseSupplierCsv(
    csvPath: string,
    mappingConfig: SupplierMappingConfig,
    warehouseMap?: Map<string, string>
  ): MappedProduct[] {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    const fileContent = fs.readFileSync(csvPath, { encoding: 'utf-8' });
    return this.parseCsvContent(fileContent, mappingConfig, warehouseMap);
  }

  public parseCsvContent(
    content: string,
    mappingConfig: SupplierMappingConfig,
    warehouseMap?: Map<string, string>
  ): MappedProduct[] {
    const records: Array<Record<string, string>> = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      bom: true
    });

    const products: MappedProduct[] = [];

    for (const record of records) {
      const sku = (record[mappingConfig.sku] ?? '').trim();
      if (!sku) {
        continue;
      }

      const title = mappingConfig.title && record[mappingConfig.title]
        ? record[mappingConfig.title].trim()
        : '';

      const description = mappingConfig.description && record[mappingConfig.description]
        ? record[mappingConfig.description].trim()
        : '';

      const stocks: ProductStock[] = mappingConfig.stocks.map((stockMap) => {
        const rawStock = record[stockMap.stock];
        const normalizedQty = this.normalizeStockQty(rawStock);
        const resolvedWarehouseId = warehouseMap?.get(stockMap.warehouse) ?? stockMap.warehouse;

        return {
          warehouseId: resolvedWarehouseId,
          isActive: 'yes',
          qty: normalizedQty
        };
      });

      products.push({
        sku,
        title,
        description,
        category: mappingConfig.category,
        stocks
      });
    }

    return products;
  }

  public normalizeStockQty(rawStock: unknown): string {
    if (rawStock === undefined || rawStock === null) {
      return '0';
    }

    const str = String(rawStock).trim();
    if (str === '') {
      return '0';
    }

    // Strip unit strings like "db", spaces, etc. (e.g. "0 db" -> "0")
    const cleaned = str.replace(/[^0-9.-]/g, '').trim();
    if (cleaned === '' || Number.isNaN(Number(cleaned))) {
      return '0';
    }

    return cleaned;
  }
}
