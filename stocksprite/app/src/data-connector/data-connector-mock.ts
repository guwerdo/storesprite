import Stream from "node:stream";
import type { Logger } from "log4js";
import { inject, injectable } from "inversify";
import fs from "fs/promises";

import { fileURLToPath } from 'url';
import { IDataConnector } from "./index.js";
import { IDataSourceConnection } from "../data-source/index.js";
import { BindingKeys } from "../types/index.js";

@injectable()
export class DataConnectorMock implements IDataConnector {
    private testData: string | undefined = undefined;

    constructor(@inject(BindingKeys.Logger) private _logger: Logger) {}

    public async init(_1: string, dataSourceConnection: IDataSourceConnection): Promise<void> {
        if (dataSourceConnection.testData === undefined) {
            const __filename = fileURLToPath(import.meta.url);
            this._logger.error("Data source test data is undefined", { source: __filename });
        }

        this.testData = dataSourceConnection.testData;
        await new Promise((resolve) => setTimeout(resolve, 1));
    }

    public async fetch(): Promise<NodeJS.ReadableStream | undefined> {
        if (this.testData === undefined) {
            const __filename = fileURLToPath(import.meta.url);
            this._logger.error("Data source test data is undefined", { source: __filename });
            process.exit(1);
        }

        try {
            await fs.access(this.testData);
        } catch {
            this._logger.error("Mock data file not found", { path: this.testData });
            process.exit(1);
        }

        try {
            const fileStream = await fs.readFile(this.testData);
            return Stream.Readable.from(fileStream);
        } catch (_)
        {
            this._logger.error("Mock data file not found", { path: this.testData });
            process.exit(1);
        }
    }

    public async close(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
}
