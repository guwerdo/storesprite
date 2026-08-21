import { IDataSourceConnection } from "../../data-source/interfaces/connection/data-source-connection.type.js";

export interface IDataConnector {
    init(dataSourceId: string, connection: IDataSourceConnection): Promise<void>;
    fetch(): Promise<NodeJS.ReadableStream | undefined>;
    close(): Promise<void>;
}
