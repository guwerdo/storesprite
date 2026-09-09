import type { WarehouseType, WarehouseVisibleOnProductDetails, YesNo } from "../get-warehouse/get-warehouse.types.js";

export type SetWarehouseAction = "add" | "modify" | "delete";

export interface ISetWarehouse {
    /** Unique ID of the warehouse. Required for 'modify' and 'delete'; optional for 'add'. */
    id?: number | string;
    /** Operation to perform: 'add', 'modify', or 'delete'. Defaults to 'add' (or 'modify' if id is provided). */
    action?: SetWarehouseAction;
    /** Internal warehouse name. */
    name?: string;
    /** Public customer-facing warehouse name. */
    publicName?: string;
    /** Customer-facing delivery info / notice text. */
    info?: string;
    /** Whether stock is active / consumed ('yes' | 'no' or boolean). */
    active?: boolean | YesNo;
    /** Display order sequence number. */
    order?: number;
    /** Warehouse type: 'own' (Saját) or 'external' (Külső). */
    type?: WarehouseType;
    /** Whether main stock movement history sync is disabled ('yes' | 'no' or boolean). */
    syncMainStockDisabled?: boolean | YesNo;
    /** Visibility in product detail stock list ('yes' | 'no' | 'only_if_on_stock' or boolean). */
    visibleOnProductDetails?: boolean | WarehouseVisibleOnProductDetails;
    /** Whether warehouse appears as a dedicated filter in product lists ('yes' | 'no' or boolean). */
    useFilter?: boolean | YesNo;
}

export interface ISetWarehouseRequest {
    warehouses: ISetWarehouse[];
}

export interface ISetWarehouseResponse {
    id: string;
    status: "ok" | "error";
    error?: string;
    action?: string;
}
