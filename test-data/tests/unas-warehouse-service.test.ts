import { describe, expect, it, vi } from 'vitest';
import { UnasWarehouseService } from '../src/services/unas-warehouse-service.js';
import type { UnasAuthService } from '../src/services/unas-auth-service.js';

describe('UnasWarehouseService', () => {
  const mockAuthService = {
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-bearer-token' })
  } as unknown as UnasAuthService;

  describe('getAllWarehouses', () => {
    it('should parse warehouses with CDATA and standard tags', async () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>5726549</Id>
        <Active>yes</Active>
        <Name><![CDATA[test-cromwell-stock-hu]]></Name>
        <PublicName><![CDATA[Központi magyar raktár]]></PublicName>
        <Order>1</Order>
        <Type>external</Type>
    </Warehouse>
    <Warehouse>
        <Id>5726554</Id>
        <Active>yes</Active>
        <Name><![CDATA[test-cromwell-stock-cz]]></Name>
        <PublicName><![CDATA[Külföldi raktár]]></PublicName>
        <Order>2</Order>
        <Type>external</Type>
    </Warehouse>
</Warehouses>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockXml
      });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      const result = await service.getAllWarehouses();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.unas.eu/shop/getWarehouse',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            Authorization: 'Bearer test-bearer-token'
          },
          body: '<?xml version="1.0" encoding="UTF-8" ?>\n<Params></Params>'
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '5726549',
        name: 'test-cromwell-stock-hu',
        publicName: 'Központi magyar raktár',
        active: 'yes',
        type: 'external',
        order: 1
      });
      expect(result[1]?.id).toBe('5726554');
      expect(result[1]?.name).toBe('test-cromwell-stock-cz');
      expect(result[1]?.order).toBe(2);
    });

    it('should return an empty array if no warehouses are present', async () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8" ?>\n<Warehouses></Warehouses>`;
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockXml
      });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      const result = await service.getAllWarehouses();
      expect(result).toEqual([]);
    });

    it('should throw an error on HTTP failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      await expect(service.getAllWarehouses()).rejects.toThrow(/UNAS getWarehouse request failed with HTTP 500/);
    });

    it('should throw an error when UNAS returns error status in XML', async () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Status>error</Status>
    <Error>Invalid Token</Error>
</Warehouses>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockXml
      });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      await expect(service.getAllWarehouses()).rejects.toThrow(/UNAS getWarehouse rejected: Invalid Token/);
    });
  });

  describe('createWarehouse', () => {
    it('should send correct XML payload and parse created warehouse Id', async () => {
      const responseXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>9876543</Id>
        <Status>ok</Status>
    </Warehouse>
</Warehouses>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => responseXml
      });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      const newId = await service.createWarehouse('test-custom-stock', 'Custom Public Stock', 8);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.unas.eu/shop/setWarehouse',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            Authorization: 'Bearer test-bearer-token'
          }
        })
      );

      const sentBody = mockFetch.mock.calls[0][1].body;
      expect(sentBody).toContain('<Action>add</Action>');
      expect(sentBody).toContain('<Active>yes</Active>');
      expect(sentBody).toContain('<![CDATA[test-custom-stock]]>');
      expect(sentBody).toContain('<![CDATA[Custom Public Stock]]>');
      expect(sentBody).toContain('<Order>8</Order>');
      expect(sentBody).toContain('<Type>external</Type>');
      expect(sentBody).toContain('<SyncMainStockDisabled>yes</SyncMainStockDisabled>');
      expect(sentBody).toContain('<VisibleOnProductDetails>only_if_on_stock</VisibleOnProductDetails>');

      expect(newId).toBe('9876543');
    });

    it('should throw an error when setWarehouse returns error status', async () => {
      const responseXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Status>error</Status>
    <Error>Duplicate warehouse name</Error>
</Warehouses>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => responseXml
      });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      await expect(service.createWarehouse('test-dup')).rejects.toThrow(/UNAS setWarehouse rejected: Duplicate warehouse name/);
    });
  });

  describe('syncWarehouses', () => {
    it('should not create warehouses if all required already exist in UNAS', async () => {
      const getXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>101</Id>
        <Name><![CDATA[test-wh-1]]></Name>
        <Order>5</Order>
    </Warehouse>
    <Warehouse>
        <Id>102</Id>
        <Name><![CDATA[test-wh-2]]></Name>
        <Order>9</Order>
    </Warehouse>
</Warehouses>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => getXml
      });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      const result = await service.syncWarehouses(['test-wh-1', 'test-wh-2']);

      expect(result.existingCount).toBe(2);
      expect(result.createdCount).toBe(0);
      expect(result.nameToId.get('test-wh-1')).toBe('101');
      expect(result.nameToId.get('test-wh-2')).toBe('102');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only getWarehouse called
    });

    it('should create missing warehouses with incremented Order exceeding maximum existing order', async () => {
      const getXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>101</Id>
        <Name><![CDATA[test-wh-1]]></Name>
        <Order>9</Order>
    </Warehouse>
</Warehouses>`;

      const setXml1 = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>202</Id>
        <Status>ok</Status>
    </Warehouse>
</Warehouses>`;

      const setXml2 = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>203</Id>
        <Status>ok</Status>
    </Warehouse>
</Warehouses>`;

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => getXml
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => setXml1
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => setXml2
        });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      const result = await service.syncWarehouses(['test-wh-1', 'test-missing-1', 'test-missing-2']);

      expect(result.existingCount).toBe(1);
      expect(result.createdCount).toBe(2);
      expect(result.nameToId.get('test-wh-1')).toBe('101');
      expect(result.nameToId.get('test-missing-1')).toBe('202');
      expect(result.nameToId.get('test-missing-2')).toBe('203');

      // First new warehouse gets Order: 10 (9 + 1)
      const firstSetBody = mockFetch.mock.calls[1][1].body;
      expect(firstSetBody).toContain('<Order>10</Order>');
      expect(firstSetBody).toContain('<![CDATA[test-missing-1]]>');

      // Second new warehouse gets Order: 11 (10 + 1)
      const secondSetBody = mockFetch.mock.calls[2][1].body;
      expect(secondSetBody).toContain('<Order>11</Order>');
      expect(secondSetBody).toContain('<![CDATA[test-missing-2]]>');
    });

    it('should never send modify or delete actions and leave all existing warehouses untouched on UNAS', async () => {
      const getXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>501</Id>
        <Name><![CDATA[test-existing-1]]></Name>
    </Warehouse>
    <Warehouse>
        <Id>502</Id>
        <Name><![CDATA[test-existing-2]]></Name>
    </Warehouse>
    <Warehouse>
        <Id>503</Id>
        <Name><![CDATA[test-unrelated-existing]]></Name>
    </Warehouse>
</Warehouses>`;

      const setXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>504</Id>
        <Status>ok</Status>
    </Warehouse>
</Warehouses>`;

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => getXml
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => setXml
        });

      const service = new UnasWarehouseService({
        authService: mockAuthService,
        fetchFn: mockFetch as unknown as typeof fetch
      });

      // Mapping specifies test-existing-1, test-existing-2, and test-new
      const result = await service.syncWarehouses(['test-existing-1', 'test-existing-2', 'test-new']);

      // 1. Existing warehouses (including unrelated ones already on UNAS) are preserved in the map
      expect(result.existingCount).toBe(3);
      expect(result.createdCount).toBe(1);
      expect(result.nameToId.get('test-existing-1')).toBe('501');
      expect(result.nameToId.get('test-existing-2')).toBe('502');
      expect(result.nameToId.get('test-unrelated-existing')).toBe('503');
      expect(result.nameToId.get('test-new')).toBe('504');

      // 2. setWarehouse was called ONLY ONCE (for test-new), never for existing ones
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const setCallBody = mockFetch.mock.calls[1][1].body;
      expect(setCallBody).toContain('<Action>add</Action>');
      expect(setCallBody).not.toContain('<Action>modify</Action>');
      expect(setCallBody).not.toContain('<Action>delete</Action>');
      expect(setCallBody).toContain('<![CDATA[test-new]]>');
    });
  });
});

