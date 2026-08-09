import { ProductDto } from "../../dto/index.js";

export interface IUnasUpdater {
    update(productDto: ProductDto): Promise<void>;
}
