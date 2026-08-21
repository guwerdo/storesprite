import { DataConnectionDto } from "./Connection.types.js";

export interface DownloadResult {
  destinationPath: string;
  isUnchanged: boolean;
  byteCount: number;
}

export interface IDownloader {
  download(connection: DataConnectionDto, destinationPath: string): Promise<DownloadResult>;
}

export interface IDownloaderFactory {
  getDownloader(channel: string): IDownloader;
}
