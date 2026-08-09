import { IDataSourceProductMapping } from "../../data-source/interfaces/product/data-source-product-mapping.interface.js";

export interface IQueuePublisher {
    publish(stream: NodeJS.ReadableStream, datasourceId: string, dataSourceProductMapping: IDataSourceProductMapping): Promise<void>;
    close(): Promise<void>;
}
