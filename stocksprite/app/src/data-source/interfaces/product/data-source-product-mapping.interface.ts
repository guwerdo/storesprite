import { IDataSourceDataMapping } from "./data-source-data-mapping.interface.js";
import { IDataSourceFieldMapping } from "./data-source-field-mapping.interface.js";
import { IDataSourceStockMapping } from "./data-source-stock-mapping.interface.js";

export interface IDataSourceProductMapping {
    sku: IDataSourceFieldMapping;
    name?: IDataSourceFieldMapping;
    descriptionLong?: IDataSourceFieldMapping;
    images?: IDataSourceFieldMapping;
    stocks?: IDataSourceStockMapping[];
    datas?: IDataSourceDataMapping[];
}
