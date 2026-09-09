import * as fs from 'node:fs';
import type { IUnasJsonClient, IWarehouseResponse } from '@storesprite/unas-json-client';
import type { SupplierMappingConfig, WarehouseSyncResult } from '../models/types.js';

export interface UnasWarehouseServiceOptions {
  client: IUnasJsonClient;
}

export class UnasWarehouseService {
  private readonly _client: IUnasJsonClient;

  public constructor(options: UnasWarehouseServiceOptions) {
    this._client = options.client;
  }

  public async getAllWarehouses(): Promise<IWarehouseResponse[]> {
    return this._client.getWarehouse();
  }

  public async createWarehouse(name: string, publicName?: string, order: number = 1): Promise<string> {
    const responses = await this._client.setWarehouse({
      warehouses: [
        {
          action: 'add',
          active: 'yes',
          name,
          publicName: publicName ?? name,
          order,
          type: 'external',
          syncMainStockDisabled: 'yes',
          visibleOnProductDetails: 'only_if_on_stock',
        },
      ],
    });

    const first = responses[0];
    if (!first || first.status === 'error' || !first.id) {
      const errorMsg = first?.error ?? 'Unknown error creating warehouse';
      throw new Error(`UNAS setWarehouse rejected: ${errorMsg}`);
    }

    return first.id;
  }

  public extractWarehouseNamesFromMappings(mappingPaths: string[]): string[] {
    const namesSet = new Set<string>();

    for (const mappingPath of mappingPaths) {
      if (!fs.existsSync(mappingPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(mappingPath, 'utf-8');
        const parsed: SupplierMappingConfig = JSON.parse(content);

        if (Array.isArray(parsed.stocks)) {
          for (const stock of parsed.stocks) {
            const name = stock.warehouse?.trim();
            if (name) {
              namesSet.add(name);
            }
          }
        }
      } catch (err) {
        console.warn(`[UnasWarehouseService] Warning: Failed to parse mapping file ${mappingPath}:`, err);
      }
    }

    return Array.from(namesSet);
  }

  public async syncWarehousesFromMappings(mappingPaths: string[]): Promise<WarehouseSyncResult> {
    const requiredNames = this.extractWarehouseNamesFromMappings(mappingPaths);
    return this.syncWarehouses(requiredNames);
  }

  public async syncWarehouses(requiredWarehouseNames: string[]): Promise<WarehouseSyncResult> {
    const existing = await this.getAllWarehouses();
    const nameToId = new Map<string, string>();

    let maxOrder = 0;
    for (const wh of existing) {
      nameToId.set(wh.name, String(wh.id));
      if (wh.order !== undefined && wh.order > maxOrder) {
        maxOrder = wh.order;
      }
    }

    const missingNames = [...new Set(requiredWarehouseNames)].filter((name) => !nameToId.has(name));

    for (let i = 0; i < missingNames.length; i++) {
      const name = missingNames[i]!;
      const order = maxOrder + i + 1;
      console.log(`[UnasWarehouseService] Warehouse "${name}" not found on UNAS. Creating with Order=${order}...`);
      const newId = await this.createWarehouse(name, undefined, order);
      console.log(`[UnasWarehouseService] -> Successfully created warehouse "${name}" with UNAS ID: ${newId}`);
      nameToId.set(name, newId);
    }

    return {
      nameToId,
      existingCount: existing.length,
      createdCount: missingNames.length,
    };
  }
}
