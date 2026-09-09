import { describe, expect, it, vi } from 'vitest';
import type { IUnasJsonClient, IWarehouseResponse } from '@storesprite/unas-json-client';
import { UnasWarehouseService } from '../src/services/unas-warehouse-service.js';

describe('UnasWarehouseService', () => {
  const createMockClient = (overrides?: Partial<IUnasJsonClient>): IUnasJsonClient => ({
    login: vi.fn(),
    getProductDB: vi.fn(),
    setProduct: vi.fn(),
    getWarehouse: vi.fn().mockResolvedValue([]),
    setWarehouse: vi.fn().mockResolvedValue([{ id: '101', status: 'ok' }]),
    ...overrides,
  });

  describe('getAllWarehouses', () => {
    it('returns warehouses from json client', async () => {
      // Arrange
      const mockWarehouses: IWarehouseResponse[] = [
        { id: 5726549, name: 'Cromwell HU', publicName: 'Központi' },
      ];
      const client = createMockClient({
        getWarehouse: vi.fn().mockResolvedValue(mockWarehouses),
      });
      const service = new UnasWarehouseService({ client });

      // Act
      const result = await service.getAllWarehouses();

      // Assert
      expect(result).toEqual(mockWarehouses);
      expect(client.getWarehouse).toHaveBeenCalledTimes(1);
    });
  });

  describe('createWarehouse', () => {
    it('calls client.setWarehouse and returns new ID', async () => {
      // Arrange
      const client = createMockClient({
        setWarehouse: vi.fn().mockResolvedValue([{ id: '999', status: 'ok' }]),
      });
      const service = new UnasWarehouseService({ client });

      // Act
      const id = await service.createWarehouse('New Wh', 'Public Wh', 3);

      // Assert
      expect(id).toBe('999');
      expect(client.setWarehouse).toHaveBeenCalledWith({
        warehouses: [
          {
            action: 'add',
            active: 'yes',
            name: 'New Wh',
            publicName: 'Public Wh',
            order: 3,
            type: 'external',
            syncMainStockDisabled: 'yes',
            visibleOnProductDetails: 'only_if_on_stock',
          },
        ],
      });
    });

    it('throws error when setWarehouse returns error status', async () => {
      // Arrange
      const client = createMockClient({
        setWarehouse: vi.fn().mockResolvedValue([{ id: '', status: 'error', error: 'Duplicate name' }]),
      });
      const service = new UnasWarehouseService({ client });

      // Act & Assert
      await expect(service.createWarehouse('Duplicate')).rejects.toThrow(/UNAS setWarehouse rejected: Duplicate name/);
    });
  });

  describe('syncWarehouses', () => {
    it('does not create warehouses if all exist', async () => {
      // Arrange
      const client = createMockClient({
        getWarehouse: vi.fn().mockResolvedValue([
          { id: 1, name: 'wh-1', publicName: 'wh-1' },
          { id: 2, name: 'wh-2', publicName: 'wh-2' },
        ]),
      });
      const service = new UnasWarehouseService({ client });

      // Act
      const result = await service.syncWarehouses(['wh-1', 'wh-2']);

      // Assert
      expect(result.existingCount).toBe(2);
      expect(result.createdCount).toBe(0);
      expect(result.nameToId.get('wh-1')).toBe('1');
      expect(result.nameToId.get('wh-2')).toBe('2');
      expect(client.setWarehouse).not.toHaveBeenCalled();
    });

    it('creates missing warehouses with incremented order', async () => {
      // Arrange
      const client = createMockClient({
        getWarehouse: vi.fn().mockResolvedValue([
          { id: 1, name: 'existing-wh', publicName: 'existing', order: 5 },
        ]),
        setWarehouse: vi.fn().mockResolvedValue([{ id: '201', status: 'ok' }]),
      });
      const service = new UnasWarehouseService({ client });

      // Act
      const result = await service.syncWarehouses(['existing-wh', 'missing-wh']);

      // Assert
      expect(result.existingCount).toBe(1);
      expect(result.createdCount).toBe(1);
      expect(result.nameToId.get('existing-wh')).toBe('1');
      expect(result.nameToId.get('missing-wh')).toBe('201');
      expect(client.setWarehouse).toHaveBeenCalledWith({
        warehouses: [
          expect.objectContaining({ name: 'missing-wh', order: 6 }),
        ],
      });
    });
  });
});
