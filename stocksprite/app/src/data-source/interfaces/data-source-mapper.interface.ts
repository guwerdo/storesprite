import { DataDto } from "../../unas/dto/data-dto.interface.js";
import { ImageDto, StockDto } from "../../unas/dto/index.js";
import { IDataSourceDataMapping } from "./product/data-source-data-mapping.interface.js";
import { IDataSourceFieldMapping } from "./product/data-source-field-mapping.interface.js";
import { IDataSourceStockMapping } from "./product/data-source-stock-mapping.interface.js";

export interface IDataSourceMapper {
    mapField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<string | undefined>;
    mapImagesField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<ImageDto[] | undefined>;
    mapStocksField(row: Record<string, string>, mapping: IDataSourceStockMapping[]): Promise<StockDto[] | undefined>;
    mapDatasField(row: Record<string, string>, mapping: IDataSourceDataMapping[]): Promise<DataDto[] | undefined>;
}
