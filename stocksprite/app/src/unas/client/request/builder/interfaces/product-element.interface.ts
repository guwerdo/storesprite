import { IDataElement } from "../../index.js";
import { IDescriptionElement } from "./description-element.interface.js";
import { IImagesElement } from "./images-element.interface.js";
import { IParamElement } from "./param-element.interface.js";
import { IStockElement } from "./stock-element.interface.js";

export interface IProductElement {
    Sku: string;
    Action: string;
    Description: IDescriptionElement | undefined;
    Stocks: { Status: { Active: number }; Stock: IStockElement[] } | undefined;
    Params: { Param: IParamElement[] } | undefined;
    Images: IImagesElement | undefined;
    Datas: { Datas: IDataElement[] } | undefined;
}
