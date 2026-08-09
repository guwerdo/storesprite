import { IProductElement } from "../../client/request/index.js";
import { ProductDto } from "../../dto/index.js";

export interface UpdateBufferItem {
    productXml: IProductElement;
    productDto: ProductDto;
}
