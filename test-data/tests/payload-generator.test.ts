import { describe, expect, it, vi } from 'vitest';
import type { IUnasJsonClient } from '@storesprite/unas-json-client';
import { PayloadGenerator } from '../src/services/payload-generator.js';

describe('PayloadGenerator', () => {
  it('instantiates cleanly with default services', () => {
    const generator = new PayloadGenerator();
    expect(generator).toBeDefined();
  });

  it('uploads products in batches', async () => {
    // Arrange
    const client = {
      login: vi.fn(),
      getProductDB: vi.fn(),
      getWarehouse: vi.fn(),
      setWarehouse: vi.fn(),
      setProduct: vi.fn().mockImplementation(async ({ products: chunk }: { products: unknown[] }) =>
        chunk.map((p: any, idx: number) => ({ id: String(idx + 1), sku: p.sku, action: 'add', status: 'ok' }))
      ),
    } as unknown as IUnasJsonClient;

    const generator = new PayloadGenerator();
    const products = [
      { sku: 'SKU-1', action: 'add' as const },
      { sku: 'SKU-2', action: 'add' as const },
    ];

    // Act
    const stats = await generator.uploadProducts(client, products, 1);

    // Assert
    expect(client.setProduct).toHaveBeenCalledTimes(2);
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(0);
  });
});
