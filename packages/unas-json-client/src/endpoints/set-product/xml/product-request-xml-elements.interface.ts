// Internal PascalCase XML element shapes for the setProduct request.
// These mirror UNAS's wire format and are not part of the public JSON API.

export interface IProductElement {
    Sku: string;
    Action: string;
    Description: IDescriptionElement | undefined;
    Stocks: { Status: { Active: number }; Stock: IStockElement[] } | undefined;
    Images: IImagesElement | undefined;
    Datas: { Data: IDataElement[] } | undefined;
}

export interface IDescriptionElement {
    Long: { "#cdata": string };
}

export interface IStockElement {
    WarehouseId: number | undefined;
    IsActive: string;
    Qty: number;
}

export interface IDataElement {
    Id: number;
    Value: { "#cdata": string };
}

export interface IImageElement {
    Type: "base" | "alt";
    Id: number;
    SefUrl: { "#cdata": string };
    Filename: { "#cdata": string };
    Alt: { "#cdata": string };
    Import: { Url: string };
}

export interface IImagesElement {
    DefaultFilename: { "#cdata": string };
    DefaultAlt: { "#cdata": string };
    OG: number;
    Version: string;
    Image: IImageElement[];
}

export interface ISetProductRequest {
    Products: {
        Product: IProductElement[];
    };
}
