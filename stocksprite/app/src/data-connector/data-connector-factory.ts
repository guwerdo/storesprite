import { IDataSourceConnection } from "../data-source/index.js";
import container from "../inversify.config.js";
import { BindingKeys } from "../types/index.js";
import { IDataConnector } from "./interfaces/data-connector.interface.js";

export const DataConnectorFactory = {
    async create(datasourceId: string, connection: IDataSourceConnection): Promise<IDataConnector> {
        switch (connection.protocol) {
            case "sftp": {
                const connector = container.get<IDataConnector>(BindingKeys.SftpDataConnector);
                await connector.init(datasourceId, connection);
                return connector;
            }
            case "http": {
                const httpConnector = container.get<IDataConnector>(BindingKeys.HttpDataConnector);
                await httpConnector.init(datasourceId, connection);
                return httpConnector;
            }
            case "file": {
                const fileConnector = container.get<IDataConnector>(BindingKeys.FileDataConnector);
                await fileConnector.init(datasourceId, connection);
                return fileConnector;
            }
            default:
                const _never: never = connection;
                return _never;
        }
    },
};
