import { Container } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "./types.js";
import { AppConfig, getAppConfig } from "../config/app.config.js";
import { configureLogger } from "../config/log4js.config.js";
import { IBackendApiClient } from "../types/backend-api-client.interface.js";
import { BackendApiClient } from "../services/backend-api-client.js";
import { IDownloader, IDownloaderFactory } from "../types/downloader.interface.js";
import { HttpDownloader } from "../services/http-downloader.js";
import { SftpDownloader } from "../services/sftp-downloader.js";
import { DownloaderFactory } from "../services/downloader-factory.js";
import { IDataConverter, IConverterFactory } from "../types/data-converter.interface.js";
import { CsvConverter } from "../services/csv-converter.js";
import { XmlConverter } from "../services/xml-converter.js";
import { ConverterFactory } from "../services/converter-factory.js";
import { IDownloaderService } from "../types/downloader-service.interface.js";
import { DownloaderService } from "../services/downloader-service.js";

export function createContainer(customConfig?: AppConfig, customLogger?: Logger): Container {
  const container = new Container({ defaultScope: "Singleton" });

  const config = customConfig || getAppConfig();
  container.bind<AppConfig>(TYPES.AppConfig).toConstantValue(config);

  const logger = customLogger || configureLogger(config.outputDir);
  container.bind<Logger>(TYPES.Logger).toConstantValue(logger);

  container.bind<IBackendApiClient>(TYPES.IBackendApiClient).to(BackendApiClient);

  container.bind<IDownloader>(TYPES.HttpDownloader).to(HttpDownloader);
  container.bind<IDownloader>(TYPES.SftpDownloader).to(SftpDownloader);
  container.bind<IDownloaderFactory>(TYPES.IDownloaderFactory).to(DownloaderFactory);

  container.bind<IDataConverter>(TYPES.CsvConverter).to(CsvConverter);
  container.bind<IDataConverter>(TYPES.XmlConverter).to(XmlConverter);
  container.bind<IConverterFactory>(TYPES.IConverterFactory).to(ConverterFactory);

  container.bind<IDownloaderService>(TYPES.IDownloaderService).to(DownloaderService);

  return container;
}
