import fs from "fs";
import { inject, injectable } from "inversify";
import { IDataSourceConnection } from "../data-source/interfaces/connection/data-source-connection.type.js";
import { IDataConnector } from "./interfaces/data-connector.interface.js";
import { BindingKeys } from "../types/index.js";
import { FileMetaData, ISftpClient, ISftpConnection } from "../sftp-client/index.js";
import { Logger } from "log4js";
import { IRepository } from "../repository/index.js";
import { IDataSourceSftpConnection } from "../data-source/interfaces/connection/data-source-sftp-connection.interface.js";

@injectable()
export class SftpDataConnector implements IDataConnector {
    private _processedFile: FileMetaData | undefined;
    private _dataSourceId = "";

    constructor(
        @inject(BindingKeys.Logger) private _logger: Logger,
        @inject(BindingKeys.ISftpClient) private _sftpClient: ISftpClient,
        @inject(BindingKeys.ProcessedItemsRepository) private _processedItemsRepository: IRepository<string>
    ) {}

    async init(dataSourceId: string, connection: IDataSourceConnection): Promise<void> {
        this._dataSourceId = dataSourceId;
        if (connection.protocol !== "sftp") {
            this._logger.error("Invalid datasource connection protocol", { protocol: connection.protocol });
            process.exit(1);
        }

        const sftpConnection = this.createSftpConnection(connection);
        await this._sftpClient.connect(sftpConnection);
    }

    async fetch(): Promise<NodeJS.ReadableStream | undefined> {
        const file = await this._sftpClient.getLatestFile();
        this._processedFile = file;

        if (await this._processedItemsRepository.exists(this._dataSourceId, file.Name)) {
            this._logger.warn("File already processed", { file: file.Name });
            this._processedFile = undefined;
            return undefined;
        }

        return this._sftpClient.getContent(file);
    }

    async close(): Promise<void> {
        if (this._processedFile) {
            await this._processedItemsRepository.add(this._dataSourceId, this._processedFile.Name);
        }
        await this._sftpClient.disconnect();
    }

    private createSftpConnection(connection: IDataSourceSftpConnection): ISftpConnection {
        return {
            host: connection.host,
            port: connection.port,
            username: connection.username,
            privateKey: fs.readFileSync(connection.privateKey),
            debug: (_: string) => {
                //console.log(`SFTP Debug: ${message}`);
            },
        };
    }
}
