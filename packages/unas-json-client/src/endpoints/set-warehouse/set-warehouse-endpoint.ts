import { inject, injectable } from "inversify";
import type { IUnasEndpoint } from "../../core/unas-endpoint.interface.js";
import type { IXmlService } from "../../core/xml-service.interface.js";
import { TYPES } from "../../types/binding-keys.js";
import type { WarehouseVisibleOnProductDetails, YesNo } from "../get-warehouse/get-warehouse.types.js";
import type { ISetWarehouse, ISetWarehouseRequest, ISetWarehouseResponse } from "./set-warehouse.types.js";

interface ISetWarehouseResponseContent {
    Warehouses?: {
        Warehouse?: {
            Id?: string | number;
            Status?: string;
            Action?: string;
            Error?: string;
        }[];
    };
}

interface IWarehouseElement {
    Id?: string | number;
    Action: string;
    Active?: YesNo;
    Name?: { "#cdata": string };
    PublicName?: { "#cdata": string };
    Info?: { "#cdata": string };
    Order?: number;
    Type?: string;
    SyncMainStockDisabled?: YesNo;
    VisibleOnProductDetails?: WarehouseVisibleOnProductDetails;
    UseFilter?: YesNo;
}

function toYesNo(val: boolean | YesNo | undefined): YesNo | undefined {
    if (val === undefined) {
        return undefined;
    }
    if (typeof val === "boolean") {
        return val ? "yes" : "no";
    }
    return val;
}

function toVisibleOnProductDetails(
    val: boolean | WarehouseVisibleOnProductDetails | undefined,
): WarehouseVisibleOnProductDetails | undefined {
    if (val === undefined) {
        return undefined;
    }
    if (typeof val === "boolean") {
        return val ? "yes" : "no";
    }
    return val;
}

function createWarehouseElement(item: ISetWarehouse): IWarehouseElement {
    const defaultAction = item.id !== undefined && item.id !== "" ? "modify" : "add";
    const action = item.action ?? defaultAction;

    return {
        Id: item.id !== undefined && item.id !== "" ? item.id : undefined,
        Action: action,
        Active: toYesNo(item.active),
        Name: item.name !== undefined ? { "#cdata": item.name } : undefined,
        PublicName: item.publicName !== undefined ? { "#cdata": item.publicName } : undefined,
        Info: item.info !== undefined ? { "#cdata": item.info } : undefined,
        Order: item.order,
        Type: item.type,
        SyncMainStockDisabled: toYesNo(item.syncMainStockDisabled),
        VisibleOnProductDetails: toVisibleOnProductDetails(item.visibleOnProductDetails),
        UseFilter: toYesNo(item.useFilter),
    };
}

@injectable()
export class SetWarehouseEndpoint implements IUnasEndpoint<ISetWarehouseRequest, ISetWarehouseResponse[]> {
    public readonly name = "setWarehouse";
    public readonly requiresAuth = true;

    constructor(@inject(TYPES.IXmlService) private readonly _xml: IXmlService) {}

    public buildRequest(request: ISetWarehouseRequest): string {
        const warehouseElements = request.warehouses.map(createWarehouseElement);
        return this._xml.buildDocument({ Warehouses: { Warehouse: warehouseElements } });
    }

    public parseResponse(xml: string): ISetWarehouseResponse[] {
        const parsed = this._xml.parse<ISetWarehouseResponseContent>(xml);
        const warehouses = parsed.Warehouses?.Warehouse;
        if (!warehouses) {
            return [];
        }
        return warehouses.map((w) => ({
            id: String(w.Id ?? "").trim(),
            status: w.Status?.toLowerCase() === "error" ? "error" : "ok",
            error: w.Error?.trim(),
            action: w.Action?.trim(),
        }));
    }
}
