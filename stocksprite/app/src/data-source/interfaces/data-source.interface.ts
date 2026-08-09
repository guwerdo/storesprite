import { IDataSourceConnection } from "./connection/data-source-connection.type.js";
import { IDataSourceProductMapping } from "./product/data-source-product-mapping.interface.js";

export interface IDataSource {
    id: string;
    enabled: boolean;
    connection: IDataSourceConnection;
    productMapping: IDataSourceProductMapping;
}
