export const TYPES = {
  AppConfig: Symbol.for("AppConfig"),
  Logger: Symbol.for("Logger"),
  IBackendApiClient: Symbol.for("IBackendApiClient"),
  HttpDownloader: Symbol.for("HttpDownloader"),
  SftpDownloader: Symbol.for("SftpDownloader"),
  IDownloaderFactory: Symbol.for("IDownloaderFactory"),
  CsvConverter: Symbol.for("CsvConverter"),
  XmlConverter: Symbol.for("XmlConverter"),
  IConverterFactory: Symbol.for("IConverterFactory"),
  IDownloaderService: Symbol.for("IDownloaderService"),
};
