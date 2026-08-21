import { injectable, inject } from "inversify";
import { TYPES } from "../di/types.js";
import { IDownloader, IDownloaderFactory } from "../types/Downloader.interface.js";

@injectable()
export class DownloaderFactory implements IDownloaderFactory {
  constructor(
    @inject(TYPES.HttpDownloader) private readonly _httpDownloader: IDownloader,
    @inject(TYPES.SftpDownloader) private readonly _sftpDownloader: IDownloader
  ) {}

  public getDownloader(channel: string): IDownloader {
    switch (channel.toUpperCase()) {
      case "HTTP":
        return this._httpDownloader;
      case "SFTP":
        return this._sftpDownloader;
      default:
        throw new Error(`Unsupported download channel: '${channel}'`);
    }
  }
}
