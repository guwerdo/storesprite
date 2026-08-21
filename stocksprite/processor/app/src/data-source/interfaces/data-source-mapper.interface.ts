import { IDataDto } from "../../unas/dto/interfaces/data-dto.interface.js";
import { IStockDto } from "../../unas/dto/interfaces/index.js";
import { IDataSourceDataMapping } from "./product/data-source-data-mapping.interface.js";
import { IDataSourceFieldMapping } from "./product/data-source-field-mapping.interface.js";
import { IDataSourceStockMapping } from "./product/data-source-stock-mapping.interface.js";

export interface IDataSourceMapper {
    mapField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<string | undefined>;
    // TODO: remove later, images not used anymore
    // mapImagesField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<IImageDto[] | undefined>;
    mapStocksField(row: Record<string, string>, mapping: IDataSourceStockMapping[]): Promise<IStockDto[] | undefined>;
    mapDatasField(row: Record<string, string>, mapping: IDataSourceDataMapping[]): Promise<IDataDto[] | undefined>;
}
