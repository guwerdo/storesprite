import { inject, injectable } from "inversify";
import type { IUnasEndpoint } from "../../core/unas-endpoint.interface.js";
import type { IXmlService } from "../../core/xml-service.interface.js";
import { TYPES } from "../../types/binding-keys.js";
import type { IWarehouseResponse } from "./get-warehouse.types.js";

interface IWarehouseContent {
    Warehouses?: { Warehouse?: { Id: string; Name: string; PublicName: string }[] };
}

@injectable()
export class GetWarehouseEndpoint implements IUnasEndpoint<undefined, IWarehouseResponse[]> {
    public readonly name = "getWarehouse";
    public readonly requiresAuth = true;

    constructor(@inject(TYPES.IXmlService) private readonly _xml: IXmlService) {}

    public buildRequest(): string | undefined {
        return undefined;
    }

    public parseResponse(xml: string): IWarehouseResponse[] {
        const parsed = this._xml.parse<IWarehouseContent>(xml);
        const warehouses = parsed.Warehouses?.Warehouse;
        if (!warehouses) {
            return [];
        }
        return warehouses.map((w) => ({ id: Number(w.Id), name: w.Name, publicName: w.PublicName }));
    }
}
