import { IDataDto, IStockDto } from "../../dto/interfaces/index.js";

export interface IUnasDataSourceMapper {
    mapSku(row: Record<string, unknown>): string | undefined;
    mapDescription(row: Record<string, unknown>): string | undefined;
    mapStocks(row: Record<string, unknown>): Promise<IStockDto[] | undefined>;
    mapDatas(row: Record<string, unknown>): IDataDto[] | undefined;
}
