import { DataDto } from "./data-dto.interface.js";
import { ImageDto } from "./image-dto.interface.js";
import { StockDto } from "./stock-dto.interface.js";
import { StockSpriteParamDto } from "./stock-sprite-param-dto.interface.js";

export interface ProductDto {
    sku: string | undefined;
    description: string | undefined;
    stocks: StockDto[] | undefined;
    images: ImageDto[] | undefined;
    stockSpriteParam: StockSpriteParamDto | undefined; // Temporary until parameter management is figured out
    datas: DataDto[] | undefined;
}
