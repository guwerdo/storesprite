import { inject, injectable } from "inversify";
import { IDataSourceConnection } from "../data-source/interfaces/connection/data-source-connection.type.js";
import { IDataConnector } from "./interfaces/data-connector.interface.js";
import { BindingKeys } from "../types/binding-keys.js";
import { Logger } from "log4js";
import { IAxiosHttpClient } from "../http-client/index.js";
import stringify from "fast-json-stable-stringify";
import { IDataSourceHttpConnection } from "../data-source/interfaces/connection/data-source-http-connection.interface.js";

@injectable()
export class HttpDataConnector implements IDataConnector {
    private _connection: IDataSourceHttpConnection | undefined;
    constructor(
        @inject(BindingKeys.IAxiosHttpClient) private _httpClient: IAxiosHttpClient,
        @inject(BindingKeys.Logger) private _logger: Logger
    ) {}

    async init(dataSourceId: string, connection: IDataSourceConnection): Promise<void> {
        if (connection.protocol !== "http") {
            this._logger.error("Invalid datasource connection protocol", { protocol: connection.protocol });
            process.exit(1);
        }
        this._connection = connection;
        await new Promise((resolve) => setTimeout(resolve, 1));
    }

    async fetch(): Promise<NodeJS.ReadableStream | undefined> {
        if (!this._connection) {
            this._logger.error("Connection not initialized");
            return undefined;
        }
        const url = `${this._connection.host}/${this._connection.path}`;
        this._logger.info(`Fetching data from HTTP source: ${url}`);
        const response = await this._httpClient.instance.get<NodeJS.ReadableStream>(url, { responseType: "stream" });
        if (response.status === 200) {
            return response.data;
        }
        this._logger.error(`Failed to fetch data from HTTP source`, { url: url, status: stringify(response.status) });
        return undefined;
    }

    async close(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
}
