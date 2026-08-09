import { Ajv, ValidateFunction } from "ajv";
import stringify from "fast-json-stable-stringify";
import { Redis } from "ioredis";
import { Logger } from "log4js";

import { DataConnectorFactory } from "./data-connector/data-connector-factory.js";
import type { IDataSources } from "./data-source/interfaces/data-sources.type.js";
import container from "./inversify.config.js";
import { IQueuePublisher } from "./queue-publishers/index.js";
import { BindingKeys } from "./types/index.js";
import { AppFile } from "./utils/file-path-util.js";
import { Util } from "./utils/index.js";

async function main() {
    const redis = container.get<Redis>(BindingKeys.Redis);
    const logger = container.get<Logger>(BindingKeys.Logger);
    const queuePublisher = container.get<IQueuePublisher>(BindingKeys.IQueuePublisher);

    const dataSources = loadDataSources();
    for (const dataSource of dataSources) {
        if (!dataSource.enabled) {
            logger.info(`Data source ${dataSource.id} is disabled. Skipping...`);
            continue;
        }
        const dataConnector = await DataConnectorFactory.create(dataSource.id, dataSource.connection);
        const data = await dataConnector.fetch();
        if (data) {
            await queuePublisher.publish(data, dataSource.id, dataSource.productMapping);
        } else {
            logger.info("Data provider: no data available.");
        }
        await dataConnector.close();
    }

    await queuePublisher.close();
    await redis.quit();
}

function loadDataSources(): IDataSources {
    const ajv = container.get<Ajv>(BindingKeys.Ajv);
    const dataSourcePath = Util.getAppFilePath(AppFile.DATA_SOURCE);
    const jsonSchema = Util.loadJsonSchema(Util.getAppFilePath(AppFile.DATA_SOURCE_SCHEMA));
    const jsonData: unknown = Util.loadJson(dataSourcePath);

    // Compile the AJV validator with proper type and wrap it as a type guard
    const validateJson: ValidateFunction<IDataSources> = ajv.compile<IDataSources>(jsonSchema);
    const isDataSources = (d: unknown): d is IDataSources => validateJson(d);

    if (isDataSources(jsonData)) {
        return jsonData;
    } else {
        console.error(`${dataSourcePath} validation failed:`);
        for (const err of validateJson.errors ?? []) {
            console.error(`  ${err.instancePath || "(root)"} ${err.message}`);
            if (err.params) console.error(`    params: ${stringify(err.params)}`);
        }
        throw new Error("Invalid data source");
    }
}

main().catch(console.error);
