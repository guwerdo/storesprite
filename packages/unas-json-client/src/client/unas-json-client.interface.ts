import type { IGetProductDBRequest } from "../endpoints/get-product-db/get-product-db.types.js";
import type { IWarehouseResponse } from "../endpoints/get-warehouse/get-warehouse.types.js";
import type { ILoginResponse } from "../endpoints/login/login.types.js";
import type { ISetProductRequest, ISetProductResponse } from "../endpoints/set-product/set-product.types.js";

export interface IUnasJsonClient {
    /** Exchange the API key for a session token; returns the full login response. Pass `true` to also fetch webshop info. */
    login(webshopInfo?: boolean): Promise<ILoginResponse>;
    /** Return the URL of the generated product CSV export. */
    getProductDB(request?: IGetProductDBRequest): Promise<string>;
    /** Add/modify products (batched); returns per-product statuses. */
    setProduct(request: ISetProductRequest): Promise<ISetProductResponse[]>;
    /** List warehouses. */
    getWarehouse(): Promise<IWarehouseResponse[]>;
}
