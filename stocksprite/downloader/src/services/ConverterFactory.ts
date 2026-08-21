import { injectable, inject } from "inversify";
import { TYPES } from "../di/types.js";
import { IDataConverter, IConverterFactory } from "../types/DataConverter.interface.js";

@injectable()
export class ConverterFactory implements IConverterFactory {
  constructor(
    @inject(TYPES.CsvConverter) private readonly _csvConverter: IDataConverter,
    @inject(TYPES.XmlConverter) private readonly _xmlConverter: IDataConverter
  ) {}

  public getConverter(format: string): IDataConverter {
    switch (format.toUpperCase()) {
      case "CSV":
        return this._csvConverter;
      case "XML":
        return this._xmlConverter;
      default:
        throw new Error(`Unsupported data format: '${format}'`);
    }
  }
}
