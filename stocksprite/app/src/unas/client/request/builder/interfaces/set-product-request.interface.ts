import { IProductElement } from "./product-element.interface.js";

export interface ISetProductRequest {
    Products: {
        Product: IProductElement[];
    };
}
