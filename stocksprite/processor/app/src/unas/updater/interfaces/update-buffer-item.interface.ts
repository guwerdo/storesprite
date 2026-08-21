import { IProductElement } from "../../client/request/builder/interfaces/index.js";
import { IProductDto } from "../../dto/interfaces/index.js";

export interface IUpdateBufferItem {
    productXml: IProductElement;
    productDto: IProductDto;
}
