import * as fs from 'node:fs';
import type { SupplierMappingConfig, UnasWarehouse, WarehouseSyncResult } from '../models/types.js';
import { escapeCdata, extractXmlValue } from '../utils/xml.js';
import { UnasAuthService } from './unas-auth-service.js';

export interface UnasWarehouseServiceOptions {
  authService?: UnasAuthService;
  getWarehouseUrl?: string;
  setWarehouseUrl?: string;
  fetchFn?: typeof fetch;
}

export class UnasWarehouseService {
  private readonly _authService: UnasAuthService;
  private readonly _getWarehouseUrl: string;
  private readonly _setWarehouseUrl: string;
  private readonly _fetchFn: typeof fetch;

  public constructor(options: UnasWarehouseServiceOptions = {}) {
    this._authService = options.authService ?? new UnasAuthService();
    this._getWarehouseUrl = options.getWarehouseUrl ?? 'https://api.unas.eu/shop/getWarehouse';
    this._setWarehouseUrl = options.setWarehouseUrl ?? 'https://api.unas.eu/shop/setWarehouse';
    this._fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  public async getAllWarehouses(): Promise<UnasWarehouse[]> {
    const xmlPayload = '<?xml version="1.0" encoding="UTF-8" ?>\n<Params></Params>';
    const responseText = await this.postXml(this._getWarehouseUrl, 'getWarehouse', xmlPayload);
    return this.parseWarehousesXml(responseText);
  }

  public async createWarehouse(name: string, publicName?: string, order: number = 1): Promise<string> {
    const safeName = escapeCdata(name);
    const safePublicName = escapeCdata(publicName ?? name);

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Action>add</Action>
        <Active>yes</Active>
        <Name><![CDATA[${safeName}]]></Name>
        <PublicName><![CDATA[${safePublicName}]]></PublicName>
        <Order>${order}</Order>
        <Type>external</Type>
        <SyncMainStockDisabled>yes</SyncMainStockDisabled>
        <VisibleOnProductDetails>only_if_on_stock</VisibleOnProductDetails>
    </Warehouse>
</Warehouses>`;

    const responseText = await this.postXml(this._setWarehouseUrl, 'setWarehouse', xmlPayload);

    const newId = extractXmlValue(responseText, 'Id');
    if (!newId) {
      throw new Error(`No <Id> returned in UNAS setWarehouse response: ${responseText}`);
    }

    return newId;
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

    const nameToId = new Map<string, string>(); // warehouseName -> warehouseId

    let maxOrder = 0;

    for (const wh of existing) {
      nameToId.set(wh.name, wh.id);
      if (wh.order !== undefined && wh.order > maxOrder) {
        maxOrder = wh.order;
      }
    }

    const missingNames = [...new Set(requiredWarehouseNames)].filter((name) => !nameToId.has(name));

    const created = await Promise.all(
      missingNames.map(async (name, index) => {
        const order = maxOrder + index + 1;
        console.log(`[UnasWarehouseService] Warehouse "${name}" not found on UNAS. Creating with Order=${order}...`);
        const newId = await this.createWarehouse(name, undefined, order);
        console.log(`[UnasWarehouseService] -> Successfully created warehouse "${name}" with UNAS ID: ${newId} (Order: ${order})`);
        return [name, newId] as const;
      })
    );

    for (const [name, id] of created) {
      nameToId.set(name, id);
    }

    return {
      nameToId,
      existingCount: existing.length,
      createdCount: missingNames.length
    };
  }

  private async postXml(url: string, opLabel: string, body: string): Promise<string> {
    const authHeaders = await this._authService.getAuthHeaders();

    let response: Response;
    try {
      response = await this._fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          ...authHeaders
        },
        body
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to communicate with UNAS ${opLabel} endpoint (${url}): ${message}`);
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`UNAS ${opLabel} request failed with HTTP ${response.status}: ${responseText}`);
    }

    const status = extractXmlValue(responseText, 'Status');
    if (status && status.toLowerCase() === 'error') {
      const errorMsg = extractXmlValue(responseText, 'Error') ?? 'Unknown UNAS error';
      throw new Error(`UNAS ${opLabel} rejected: ${errorMsg}`);
    }

    return responseText;
  }

  private parseWarehousesXml(xml: string): UnasWarehouse[] {
    const warehouseRegex = /<Warehouse(?:\s[^>]*)?>([\s\S]*?)<\/Warehouse>/gi;
    let match: RegExpExecArray | null;
    const warehouses: UnasWarehouse[] = [];

    while ((match = warehouseRegex.exec(xml)) !== null) {
      const block = match[1];
      const id = extractXmlValue(block, 'Id');
      const name = extractXmlValue(block, 'Name');
      const publicName = extractXmlValue(block, 'PublicName');
      const active = extractXmlValue(block, 'Active');
      const type = extractXmlValue(block, 'Type');
      const orderRaw = extractXmlValue(block, 'Order');
      const order = orderRaw && !Number.isNaN(Number(orderRaw)) ? Number(orderRaw) : undefined;

      if (id && name) {
        warehouses.push({
          id,
          name,
          publicName: publicName ?? undefined,
          active: active ?? undefined,
          type: type ?? undefined,
          order
        });
      }
    }

    return warehouses;
  }
}
