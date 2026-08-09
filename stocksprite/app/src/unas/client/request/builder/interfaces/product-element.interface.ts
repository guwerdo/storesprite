import { IDataElement } from "./data-element.interface.js";
import { IDescriptionElement } from "./description-element.interface.js";
import { IImagesElement } from "./images-element.interface.js";
import { IStockElement } from "./stock-element.interface.js";

export interface IProductElement {
    Sku: string;
    Action: string;
    Description: IDescriptionElement | undefined;
    Stocks: { Status: { Active: number }; Stock: IStockElement[] } | undefined;
    Images: IImagesElement | undefined;
    Datas: { Data: IDataElement[] } | undefined;
}
