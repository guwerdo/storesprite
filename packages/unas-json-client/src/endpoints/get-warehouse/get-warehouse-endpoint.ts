import { inject, injectable } from "inversify";
import type { IUnasEndpoint } from "../../core/unas-endpoint.interface.js";
import type { IXmlService } from "../../core/xml-service.interface.js";
import { TYPES } from "../../types/binding-keys.js";
import type {
    IGetWarehouseRequest,
    IWarehouseResponse,
    WarehouseType,
    WarehouseVisibleOnProductDetails,
    YesNo,
} from "./get-warehouse.types.js";

interface IRawWarehouse {
    Id: string;
    Name?: string;
    PublicName?: string;
    Info?: string;
    Active?: string;
    Order?: string;
    Type?: string;
    SyncMainStockDisabled?: string;
    VisibleOnProductDetails?: string;
    UseFilter?: string;
}

interface IWarehouseContent {
    Warehouses?: { Warehouse?: IRawWarehouse[] };
}

function trimString(val: string | undefined): string | undefined {
    return typeof val === "string" ? val.trim() : undefined;
}

@injectable()
export class GetWarehouseEndpoint implements IUnasEndpoint<IGetWarehouseRequest | undefined, IWarehouseResponse[]> {
    public readonly name = "getWarehouse";
    public readonly requiresAuth = true;

    constructor(@inject(TYPES.IXmlService) private readonly _xml: IXmlService) {}

    public buildRequest(request?: IGetWarehouseRequest): string | undefined {
        if (!request || (request.id === undefined && request.name === undefined)) {
            return undefined;
        }

        const params: Record<string, unknown> = {};
        if (request.id !== undefined && request.id !== "") {
            params.Id = request.id;
        }
        if (request.name !== undefined && request.name !== "") {
            params.Name = request.name;
        }

        return this._xml.buildDocument({ Params: params });
    }

    public parseResponse(xml: string): IWarehouseResponse[] {
        const parsed = this._xml.parse<IWarehouseContent>(xml);
        const warehouses = parsed.Warehouses?.Warehouse;
        if (!warehouses) {
            return [];
        }

        return warehouses.map((w) => {
            const rawOrder = trimString(w.Order);
            const orderNum = rawOrder !== undefined && rawOrder !== "" && !Number.isNaN(Number(rawOrder)) ? Number(rawOrder) : undefined;

            return {
                id: Number(trimString(w.Id) ?? "0"),
                name: trimString(w.Name) ?? "",
                publicName: trimString(w.PublicName) ?? "",
                info: trimString(w.Info),
                active: trimString(w.Active) as YesNo | undefined,
                order: orderNum,
                type: trimString(w.Type) as WarehouseType | undefined,
                syncMainStockDisabled: trimString(w.SyncMainStockDisabled) as YesNo | undefined,
                visibleOnProductDetails: trimString(w.VisibleOnProductDetails) as WarehouseVisibleOnProductDetails | undefined,
                useFilter: trimString(w.UseFilter) as YesNo | undefined,
            };
        });
    }
}
