import csv from "csv-parser";

import { ICsvStreamFactory } from "./index.js";

export class CsvStreamFactory implements ICsvStreamFactory {
    public createStream(): NodeJS.WritableStream {
        return csv();
    }
}
