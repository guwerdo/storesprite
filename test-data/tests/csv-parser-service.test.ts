import { describe, expect, it } from 'vitest';
import { CsvParserService } from '../src/services/csv-parser-service.js';
import type { SupplierMappingConfig } from '../src/models/types.js';

describe('CsvParserService', () => {
  const service = new CsvParserService();

  describe('normalizeStockQty', () => {
    it('should normalize standard numbers', () => {
      expect(service.normalizeStockQty('10')).toBe('10');
      expect(service.normalizeStockQty(5)).toBe('5');
      expect(service.normalizeStockQty('0')).toBe('0');
    });

    it('should strip suffixes like "db"', () => {
      expect(service.normalizeStockQty('0 db')).toBe('0');
      expect(service.normalizeStockQty('12 db')).toBe('12');
    });

    it('should handle empty or null values with 0', () => {
      expect(service.normalizeStockQty(undefined)).toBe('0');
      expect(service.normalizeStockQty(null)).toBe('0');
      expect(service.normalizeStockQty('')).toBe('0');
      expect(service.normalizeStockQty('   ')).toBe('0');
    });
  });

  describe('parseCsvContent', () => {
    it('should parse standard CSV with multi-warehouse stocks', () => {
      const csv = `part;web_title;description;free_stock_hu;free_stock_cz
SKU-001;Product Title 1;Product Description 1;10;5
SKU-002;Product Title 2;Product Description 2;0;20`;

      const mapping: SupplierMappingConfig = {
        sku: 'part',
        title: 'web_title',
        description: 'description',
        stocks: [
          { warehouse: 'wh-hu', stock: 'free_stock_hu' },
          { warehouse: 'wh-cz', stock: 'free_stock_cz' }
        ]
      };

      const result = service.parseCsvContent(csv, mapping);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sku: 'SKU-001',
        title: 'Product Title 1',
        description: 'Product Description 1',
        stocks: [
          { warehouseId: 'wh-hu', isActive: 'yes', qty: '10' },
          { warehouseId: 'wh-cz', isActive: 'yes', qty: '5' }
        ]
      });
      expect(result[1]?.stocks[1]).toEqual({
        warehouseId: 'wh-cz',
        isActive: 'yes',
        qty: '20'
      });
    });

    it('should handle CSV feeds where title or description are not present', () => {
      const csv = `sku;stock
1820;84
546;100`;

      const mapping: SupplierMappingConfig = {
        sku: 'sku',
        title: 'title',
        description: 'description',
        stocks: [{ warehouse: 'madalbal-stock', stock: 'stock' }]
      };

      const result = service.parseCsvContent(csv, mapping);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sku: '1820',
        title: '',
        description: '',
        stocks: [{ warehouseId: 'madalbal-stock', isActive: 'yes', qty: '84' }]
      });
    });

    it('should skip rows with missing or empty SKU', () => {
      const csv = `sku;title;stock
;Empty SKU;10
VALID-1;Valid Item;5`;

      const mapping: SupplierMappingConfig = {
        sku: 'sku',
        title: 'title',
        description: 'description',
        stocks: [{ warehouse: 'wh', stock: 'stock' }]
      };

      const result = service.parseCsvContent(csv, mapping);
      expect(result).toHaveLength(1);
      expect(result[0]?.sku).toBe('VALID-1');
    });
  });
});
