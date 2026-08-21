import { IDataSourceFieldMapping } from "./data-source-field-mapping.interface.js";

export interface IDataSourceStockMapping {
    warehouseId: number;
    mapping: IDataSourceFieldMapping;
}
