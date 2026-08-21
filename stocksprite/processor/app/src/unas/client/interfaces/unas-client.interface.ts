import { IProductElementResponse, IWarehouseElementResponse } from "../response/index.js";

export interface IUnasClient {
    getProductDb(): Promise<string>;
    setProduct(request: string): Promise<IProductElementResponse[]>;
    getWarehouse(): Promise<IWarehouseElementResponse[]>;
}
