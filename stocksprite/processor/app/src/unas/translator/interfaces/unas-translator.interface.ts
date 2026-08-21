import { IProductDto } from "../../dto/interfaces/index.js";

export interface IUnasTranslator {
    translate(productDto: IProductDto): Promise<void>;
}
