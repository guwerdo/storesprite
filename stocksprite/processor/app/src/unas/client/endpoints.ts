import type { IConfiguration } from "../../configuration/interfaces/configuration.interface.js";

export function createEndpoints(configuration: IConfiguration) {
    const unasApiBase = configuration.get<string>("unasApiBase");

    if (!unasApiBase) {
        throw new Error("Missing required configuration key: unasApiBase");
    }

    return {
        LOGIN: `${unasApiBase}login`,
        GET_PRODUCT_DB: `${unasApiBase}getProductDB`,
        SET_PRODUCT: `${unasApiBase}setProduct`,
        GET_WAREHOUSE: `${unasApiBase}getWarehouse`,
    };
}
