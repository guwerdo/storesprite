export interface ISetProductRequest {
    products: ISetProduct[];
}

export interface ISetProduct {
    sku: string;
    action?: "add" | "modify"; // default "modify"
    description?: string;
    stocks?: ISetProductStock[];
    images?: ISetProductImages;
    datas?: ISetProductData[];
}

export interface ISetProductStock {
    warehouseId?: number; // 1 (or omitted) = main warehouse
    quantity: number;
    isActive?: boolean; // default true
}

export interface ISetProductData {
    id: number;
    value: string;
}

export interface ISetProductImages {
    defaultFilename: string;
    defaultAlt: string;
    og: number;
    version: string;
    images: ISetProductImage[];
}

export interface ISetProductImage {
    type: "base" | "alt";
    id: number;
    sefUrl: string;
    filename: string;
    alt: string;
    importUrl: string;
}

export interface ISetProductResponse {
    id: string;
    sku: string;
    action: string;
    status: "ok" | "error";
}
