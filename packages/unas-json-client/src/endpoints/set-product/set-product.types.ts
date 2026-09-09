import type { YesNo } from "../get-warehouse/get-warehouse.types.js";

export type SetProductCategoryType = "base" | "alt";
export type SetProductPriceType = "normal" | "sale" | "special";

export interface ISetProductCategory {
    id: number | string;
    type?: SetProductCategoryType | (string & {});
}

export interface ISetProductPriceItem {
    type?: SetProductPriceType | (string & {});
    net?: number | string;
    gross?: number | string;
    actual?: number | string;
}

export interface ISetProductPrices {
    vat?: string;
    prices?: ISetProductPriceItem[];
}

export interface ISetProductStock {
    warehouseId?: number | string;
    quantity: number;
    isActive?: boolean | YesNo;
}

export interface ISetProductData {
    id: number;
    value: string;
}

export interface ISetProductImage {
    type: "base" | "alt";
    id: number;
    sefUrl: string;
    filename: string;
    alt: string;
    importUrl: string;
}

export interface ISetProductImages {
    defaultFilename: string;
    defaultAlt: string;
    og: number;
    version: string;
    images: ISetProductImage[];
}

export interface ISetProduct {
    sku: string;
    action?: "add" | "modify";
    name?: string;
    description?: string;
    categories?: ISetProductCategory[];
    prices?: ISetProductPrices;
    stocks?: ISetProductStock[];
    images?: ISetProductImages;
    datas?: ISetProductData[];
}

export interface ISetProductRequest {
    products: ISetProduct[];
}

export interface ISetProductResponse {
    id: string;
    sku: string;
    action: string;
    status: "ok" | "error";
}
