import { inject, injectable } from "inversify";
import type { IDataSourceConnection } from "../data-source/interfaces/connection/data-source-connection.type.js";
import type { IDataConnector } from "./interfaces/data-connector.interface.js";
import { BindingKeys } from "../types/binding-keys.js";
import type { Logger } from "log4js";
import type { IDataSourceFileConnection } from "../data-source/interfaces/connection/data-source-file-connection.interface.js";
import * as fs from "fs";

@injectable()
export class FileDataConnector implements IDataConnector {
    private _connection: IDataSourceFileConnection | undefined;
    constructor(
        @inject(BindingKeys.Logger) private _logger: Logger
    ) {}

    async init(dataSourceId: string, connection: IDataSourceConnection): Promise<void> {
        if (connection.protocol !== "file") {
            this._logger.error("Invalid datasource connection protocol", { protocol: connection.protocol });
            process.exit(1);
        }
        this._connection = connection;
        await new Promise((resolve) => setTimeout(resolve, 1));
    }

    fetch(): Promise<NodeJS.ReadableStream | undefined> {
        const connection = this._connection;
        if (!connection) {
            this._logger.error("Connection not initialized");
            return Promise.resolve(undefined);
        }

        if (!fs.existsSync(connection.path)) {
            this._logger.error("File not found", { path: connection.path });
            return Promise.resolve(undefined);
        }

        this._logger.info(`Fetching data from file source: ${connection.path}`);
        const stream = fs.createReadStream(connection.path);
        stream.on("error", (error) => {
            this._logger.error("Error reading file", { path: connection.path, error });
        });
        return Promise.resolve(stream);
    }

    async close(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
}
