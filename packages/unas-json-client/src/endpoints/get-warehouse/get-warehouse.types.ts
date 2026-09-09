export interface IGetWarehouseRequest {
    /** Filter by warehouse unique ID */
    id?: number | string;
    /** Filter by warehouse exact name */
    name?: string;
}

export type WarehouseType = "own" | "external";
export type WarehouseVisibleOnProductDetails = "yes" | "no" | "only_if_on_stock";
export type YesNo = "yes" | "no";

export interface IWarehouseResponse {
    id: number;
    name: string;
    publicName: string;
    info?: string;
    active?: YesNo;
    order?: number;
    type?: WarehouseType;
    syncMainStockDisabled?: YesNo;
    visibleOnProductDetails?: WarehouseVisibleOnProductDetails;
    useFilter?: YesNo;
}
