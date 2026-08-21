import csv from "csv-parser";

import { ICsvStreamFactory } from "./index.js";

export class CsvStreamFactory implements ICsvStreamFactory {
    public createStream(): NodeJS.WritableStream {
        // Use semicolon as separator
        // In Hungarian numeric formatting, the comma (,) is used as the decimal separator (e.g., 1,234)
        // Many European countries, the semicolon (;) is commonly used as the default field separator in CSV files to avoid conflicts with the comma used in numeric values.
        return csv({ separator: ";" });
    }
}
