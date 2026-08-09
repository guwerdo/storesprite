import Stream from "node:stream";
import Client from "ssh2-sftp-client";
import type { Logger } from "log4js";
import { inject, injectable } from "inversify";
import { FileMetaData, ISftpClient, ISftpConnection } from "./index.js";
import { BindingKeys } from "../types/index.js";
import { Util } from "../utils/index.js";

@injectable()
export class SftpClient implements ISftpClient {
    private readonly _remoteDirectory: string = "/";

    constructor(
        @inject(Client) private _client: Client,
        @inject(BindingKeys.Logger) private _logger: Logger,
    ) {}

    public async connect(connection:ISftpConnection): Promise<void> {
        this._logger.info("Connecting to SFTP server", { host: connection.host, port: connection.port });
        await this._client.connect(connection);
    }

    public async disconnect(): Promise<void> {
        this._logger.info("Disconnecting from SFTP server");
        await this._client.end();
    }

    public async getFiles(): Promise<FileMetaData[]> {
        try {
            const files = await this._client.list(this._remoteDirectory);
            if (files.length === 0) {
                this._logger.info("No files found in directory", { directory: this._remoteDirectory });
            } else {
                const fileNames = files.map((file) => file.name).join(", ");
                this._logger.info("Files found in directory", { directory: this._remoteDirectory, files: fileNames });
            }

            return files.map((file) => ({
                Name: file.name,
                ModifyTime: file.modifyTime ? new Date(file.modifyTime) : new Date(0),
            }));
        } catch (error: unknown) {
            if (error instanceof Error) {
                this._logger.error("Failed to list files", { error: Util.stringifyError(error) });
            } else {
                this._logger.error("Failed to list files: Unknown error");
            }
            return [];
        }
    }

    public async getLatestFile(): Promise<FileMetaData> {
        const files = await this.getFiles();
        return files.reduce((latest, current) => {
            return current.ModifyTime > latest.ModifyTime ? current : latest;
        }, files[0]);
    }

    public getContent(file: FileMetaData): NodeJS.ReadableStream {
        try {
            const result = new Stream.PassThrough();
            this._client.get(`${this._remoteDirectory}${file.Name}`, result).catch((error: unknown) => {
                this._logger.error("Failed to download file", { error: Util.stringifyError(error) });
                result.destroy();
            });
            return result;
        } catch (error: unknown) {
            if (error instanceof Error) {
                this._logger.error("Failed to download file", { error: Util.stringifyError(error) });
            } else {
                this._logger.error("Failed to download file: Unknown error");
            }
            throw error;
        }
    }
}
