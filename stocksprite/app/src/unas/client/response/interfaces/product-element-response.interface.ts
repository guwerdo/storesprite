import { UnasProductUpdateStatus } from "../../../../types/index.js";

export interface IProductElementResponse {
    Id: string;
    Sku: string;
    Action: string;
    Status: UnasProductUpdateStatus;
}
