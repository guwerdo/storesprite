import { FileMetaData } from "./file-meta-data.interface.js";
import { ISftpConnection } from "./sftp-connection.interface.js";

export interface ISftpClient {
    connect(config: ISftpConnection): Promise<void>;
    getFiles(): Promise<FileMetaData[]>;
    getLatestFile(): Promise<FileMetaData>;
    getContent(file: FileMetaData): NodeJS.ReadableStream;
    disconnect(): Promise<void>;
}
