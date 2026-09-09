export interface IProductElement {
    Sku: string;
    Action: string;
    Name: { "#cdata": string } | undefined;
    Description: IDescriptionElement | undefined;
    Categories: { Category: ICategoryElement[] } | undefined;
    Prices: IPricesElement | undefined;
    Stocks: { Status: { Active: number }; Stock: IStockElement[] } | undefined;
    Images: IImagesElement | undefined;
    Datas: { Data: IDataElement[] } | undefined;
}

export interface IDescriptionElement {
    Long: { "#cdata": string };
}

export interface ICategoryElement {
    Type: string;
    Id: string | number;
}

export interface IPriceElement {
    Type: string;
    Net?: number | string;
    Gross?: number | string;
    Actual?: number | string;
}

export interface IPricesElement {
    Vat?: string;
    Price?: IPriceElement[];
}

export interface IStockElement {
    WarehouseId: number | string | undefined;
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
