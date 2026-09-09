import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SupplierMappingConfig, UnasWarehouse, WarehouseSyncResult } from '../models/types.js';
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
    const token = await this._authService.getValidToken();
    const xmlPayload = '<?xml version="1.0" encoding="UTF-8" ?>\n<Params></Params>';

    let response: Response;
    try {
      response = await this._fetchFn(this._getWarehouseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          Authorization: `Bearer ${token}`
        },
        body: xmlPayload
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to communicate with UNAS getWarehouse endpoint (${this._getWarehouseUrl}): ${message}`);
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`UNAS getWarehouse request failed with HTTP ${response.status}: ${responseText}`);
    }

    const status = this.extractXmlValue(responseText, 'Status');
    if (status && status.toLowerCase() === 'error') {
      const errorMsg = this.extractXmlValue(responseText, 'Error') ?? 'Unknown UNAS error';
      throw new Error(`UNAS getWarehouse rejected: ${errorMsg}`);
    }

    return this.parseWarehousesXml(responseText);
  }

  public async createWarehouse(name: string, publicName?: string): Promise<string> {
    const token = await this._authService.getValidToken();
    const safeName = this.escapeCdata(name);
    const safePublicName = this.escapeCdata(publicName ?? name);

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Action>add</Action>
        <Active>yes</Active>
        <Name><![CDATA[${safeName}]]></Name>
        <PublicName><![CDATA[${safePublicName}]]></PublicName>
        <Order>4</Order>
        <Type>external</Type>
        <SyncMainStockDisabled>yes</SyncMainStockDisabled>
        <VisibleOnProductDetails>yes</VisibleOnProductDetails>
    </Warehouse>
</Warehouses>`;

    let response: Response;
    try {
      response = await this._fetchFn(this._setWarehouseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          Authorization: `Bearer ${token}`
        },
        body: xmlPayload
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to communicate with UNAS setWarehouse endpoint (${this._setWarehouseUrl}): ${message}`);
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`UNAS setWarehouse request failed with HTTP ${response.status}: ${responseText}`);
    }

    const status = this.extractXmlValue(responseText, 'Status');
    if (status && status.toLowerCase() === 'error') {
      const errorMsg = this.extractXmlValue(responseText, 'Error') ?? 'Unknown UNAS error';
      throw new Error(`UNAS setWarehouse rejected: ${errorMsg}`);
    }

    const newId = this.extractXmlValue(responseText, 'Id');
    if (!newId) {
      throw new Error(`No <Id> returned in UNAS setWarehouse response: ${responseText}`);
    }

    return newId;
  }

  public extractWarehouseNamesFromMappings(csvDir: string): string[] {
    if (!fs.existsSync(csvDir)) {
      return [];
    }

    const files = fs.readdirSync(csvDir);
    const mappingFiles = files.filter((f) => f.endsWith('-mapping.json') || f.endsWith('mapping.json'));
    const namesSet = new Set<string>();

    for (const mappingFile of mappingFiles) {
      try {
        const fullPath = path.join(csvDir, mappingFile);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed: SupplierMappingConfig = JSON.parse(content);

        if (Array.isArray(parsed.stocks)) {
          for (const stock of parsed.stocks) {
            if (stock.warehouse && typeof stock.warehouse === 'string' && stock.warehouse.trim()) {
              namesSet.add(stock.warehouse.trim());
            }
          }
        }
      } catch (err) {
        console.warn(`[UnasWarehouseService] Warning: Failed to parse mapping file ${mappingFile}:`, err);
      }
    }

    return Array.from(namesSet);
  }

  public async syncWarehousesFromMappings(csvDir: string): Promise<WarehouseSyncResult> {
    const requiredNames = this.extractWarehouseNamesFromMappings(csvDir);
    return this.syncWarehouses(requiredNames);
  }

  public async syncWarehouses(requiredWarehouseNames: string[]): Promise<WarehouseSyncResult> {
    const existing = await this.getAllWarehouses();

    const warehouses = new Map<string, string>(); // warehouseId -> warehouseName
    const nameToId = new Map<string, string>();   // warehouseName -> warehouseId

    for (const wh of existing) {
      warehouses.set(wh.id, wh.name);
      nameToId.set(wh.name, wh.id);
    }

    const existingCount = existing.length;
    let createdCount = 0;

    for (const requiredName of requiredWarehouseNames) {
      if (!nameToId.has(requiredName)) {
        console.log(`[UnasWarehouseService] Warehouse "${requiredName}" not found on UNAS. Creating...`);
        const newId = await this.createWarehouse(requiredName);
        nameToId.set(requiredName, newId);
        warehouses.set(newId, requiredName);
        createdCount++;
        console.log(`[UnasWarehouseService] -> Successfully created warehouse "${requiredName}" with UNAS ID: ${newId}`);
      }
    }

    return {
      warehouses,
      nameToId,
      existingCount,
      createdCount
    };
  }

  private parseWarehousesXml(xml: string): UnasWarehouse[] {
    const warehouseRegex = /<Warehouse(?:\s[^>]*)?>([\s\S]*?)<\/Warehouse>/gi;
    let match: RegExpExecArray | null;
    const warehouses: UnasWarehouse[] = [];

    while ((match = warehouseRegex.exec(xml)) !== null) {
      const block = match[1];
      const id = this.extractXmlValue(block, 'Id');
      const name = this.extractXmlValue(block, 'Name');
      const publicName = this.extractXmlValue(block, 'PublicName');
      const active = this.extractXmlValue(block, 'Active');
      const type = this.extractXmlValue(block, 'Type');

      if (id && name) {
        warehouses.push({
          id,
          name,
          publicName: publicName ?? undefined,
          active: active ?? undefined,
          type: type ?? undefined
        });
      }
    }

    return warehouses;
  }

  private extractXmlValue(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = regex.exec(xml);
    if (!match) {
      return null;
    }

    let val = match[1].trim();
    if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
      val = val.slice(9, -3).trim();
    }
    return val;
  }

  private escapeCdata(text: string): string {
    return text.replace(/\]\]>/g, ']]]]><![CDATA[>');
  }
}
