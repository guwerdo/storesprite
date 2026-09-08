import { describe, expect, it } from 'vitest';
import { XmlBuilderService } from '../src/services/xml-builder-service.js';
import type { MappedProduct } from '../src/models/types.js';

describe('XmlBuilderService', () => {
  const service = new XmlBuilderService();

  it('should render a product according to the UNAS setProduct XML format', () => {
    const product: MappedProduct = {
      sku: 'TEST-SKU-100',
      title: 'Drill Set 10mm',
      description: 'Heavy duty drill bit set',
      stocks: [
        { warehouseId: 'wh-main', isActive: 'yes', qty: '15' },
        { warehouseId: 'wh-secondary', isActive: 'yes', qty: '0' }
      ]
    };

    const xml = service.renderProduct(product);

    expect(xml).toContain('<Sku>TEST-SKU-100</Sku>');
    expect(xml).toContain('<Action>add</Action>');
    expect(xml).toContain('<Name> <![CDATA[Drill Set 10mm]]> </Name>');
    expect(xml).toContain('<![CDATA[ Heavy duty drill bit set ]]>');
    expect(xml).toContain('<WarehouseId>wh-main</WarehouseId>');
    expect(xml).toContain('<Qty>15</Qty>');
    expect(xml).toContain('<WarehouseId>wh-secondary</WarehouseId>');
    expect(xml).toContain('<Qty>0</Qty>');
    expect(xml).toContain('<Vat>27%</Vat>');
  });

  it('should escape special XML characters and handle CDATA correctly', () => {
    const product: MappedProduct = {
      sku: 'SKU&<>"\'',
      title: 'Name with <tags> & "quotes"',
      description: 'Description containing ]]> end CDATA tag',
      stocks: [{ warehouseId: 'wh&1', isActive: 'yes', qty: '5' }]
    };

    const xml = service.renderProduct(product);

    expect(xml).toContain('<Sku>SKU&amp;&lt;&gt;&quot;&apos;</Sku>');
    expect(xml).toContain('<WarehouseId>wh&amp;1</WarehouseId>');
    expect(xml).toContain(']]]]><![CDATA[>');
  });

  it('should build a complete <Products> document', () => {
    const products: MappedProduct[] = [
      {
        sku: 'SKU-1',
        title: 'Title 1',
        description: 'Desc 1',
        stocks: [{ warehouseId: 'wh-1', isActive: 'yes', qty: '1' }]
      },
      {
        sku: 'SKU-2',
        title: 'Title 2',
        description: 'Desc 2',
        stocks: [{ warehouseId: 'wh-2', isActive: 'yes', qty: '2' }]
      }
    ];

    const xml = service.buildPayloadXml(products);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" ?>\n<Products>\n')).toBe(true);
    expect(xml.endsWith('</Products>\n')).toBe(true);
    expect(xml).toContain('<Sku>SKU-1</Sku>');
    expect(xml).toContain('<Sku>SKU-2</Sku>');
  });
});
