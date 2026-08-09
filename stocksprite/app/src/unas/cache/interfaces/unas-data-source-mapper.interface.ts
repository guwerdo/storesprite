import { DataDto } from "../../dto/data-dto.interface.js";
import { StockDto, StockSpriteParamDto } from "../../dto/index.js";

export interface IUnasDataSourceMapper {
    mapSku(row: Record<string, unknown>): string | undefined;
    mapDescription(row: Record<string, unknown>): string | undefined;
    mapStocks(row: Record<string, unknown>): Promise<StockDto[] | undefined>;
    mapStockSpriteParam(row: Record<string, unknown>): StockSpriteParamDto | undefined;
    mapDatas(row: Record<string, unknown>): DataDto[] | undefined;
}
