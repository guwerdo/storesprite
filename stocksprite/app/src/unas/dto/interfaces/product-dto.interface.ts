import { IDataDto, IImageDto, IStockDto } from "./index.js";

export interface IProductDto {
    sku: string | undefined;
    description: string | undefined;
    stocks: IStockDto[] | undefined;
    images: IImageDto[] | undefined;
    datas: IDataDto[] | undefined;
}
