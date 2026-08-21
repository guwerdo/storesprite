import { DataConnectionDto } from "./Connection.types.js";

export interface ConvertResult {
  outputPath: string;
  rowCount?: number;
  byteCount: number;
}

export interface IDataConverter {
  convert(connection: DataConnectionDto, inputRawPath: string, outputCsvPath: string): Promise<ConvertResult>;
}

export interface IConverterFactory {
  getConverter(format: string): IDataConverter;
}
