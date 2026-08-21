import AjvModule, { Ajv } from "ajv";
import { Queue } from "bullmq";
import { Container } from "inversify";
import { Redis } from "ioredis";
import log4js from "log4js";
import path from "node:path";

import { ConfigurationBuilder, IConfiguration } from "./configuration/index.js";
import { IBullMqConfiguration } from "./configuration/interfaces/bullmq-configuration.interface.js";
import { ILog4jsConfiguration } from "./configuration/interfaces/log4js-configuration.interface.js";
import { IRedisConfiguration } from "./configuration/interfaces/redis-configuration.interface.js";
import { CsvStreamProcessor } from "./csv-stream-processor/csv-stream-processor.js";
import { CsvStreamFactory, ICsvStreamFactory } from "./csv-stream-processor/index.js";
import { ICsvStreamProcessor } from "./csv-stream-processor/interfaces/csv-stream-processor.interface.js";
import { FileDataConnector, HttpDataConnector, IDataConnector } from "./data-connector/index.js";
import {
    DataSourceMapper,
    DataSourceRuleCollection,
    DataSourceRuleProvider,
    IDataSourceMapper,
    IDataSourceRuleCollection,
    IDataSourceRuleProvider,
} from "./data-source/index.js";
import { AxiosHttpClient, IAxiosHttpClient } from "./http-client/index.js";
import { jsonWithDataFieldLayout } from "./log/index.js";
import { SettingsRepository, ValidatedUrlsRepository } from "./repository/index.js";
import { UnasCacheRepository, WarehouseRepository } from "./repository/index.js";
import { ICacheRepository, IRepository } from "./repository/interfaces/index.js";
import { BindingKeys } from "./types/index.js";
import { IUnasDataSourceMapper, UnasDataSourceMapper } from "./unas/cache/index.js";
import { IUnasClient, UnasClient } from "./unas/client/index.js";
import { IProductDto } from "./unas/dto/interfaces/index.js";
import { WarehouseDto } from "./unas/dto/warehouse-dto.interface.js";
import { IUnasTranslator } from "./unas/translator/interfaces/index.js";
import { UnasTranslator } from "./unas/translator/unas-translator.js";
import { customLogicOperators } from "./data-source/json-logic-custom-operator.js";

// Register custom JSON Logic operators
customLogicOperators();

const container = new Container();
const ajvImpl = AjvModule.default || AjvModule;

// Build configuration from default sources
const configuration = ConfigurationBuilder.createDefault().build();

// Register Configuration (can be overridden for testing)
container.bind<IConfiguration>(BindingKeys.IConfiguration).toConstantValue(configuration);

// Get typed configuration sections
const log4jsConfig = configuration.getSection<ILog4jsConfiguration>("log4js");
const redisConfig = configuration.getSection<IRedisConfiguration>("redis");
const bullMqConfig = configuration.getSection<IBullMqConfiguration>("bullMq");

if (!log4jsConfig || !redisConfig || !bullMqConfig) {
    throw new Error("Required configuration sections are missing");
}

log4js.addLayout("json-with-data-field", jsonWithDataFieldLayout);
const mainFileName = path.basename(process.argv[1], path.extname(process.argv[1]));
container.bind<log4js.Logger>(BindingKeys.Logger).toConstantValue(log4js.configure(log4jsConfig).getLogger(mainFileName));
container.bind<Ajv>(BindingKeys.Ajv).toConstantValue(new ajvImpl({ allErrors: true, strict: false }));
container.bind<ICsvStreamFactory>(BindingKeys.ICsvStreamFactory).to(CsvStreamFactory).inSingletonScope();
container
    .bind<Redis>(BindingKeys.Redis)
    .toDynamicValue(() => new Redis({ host: redisConfig.connection.host, enableReadyCheck: true }))
    .inSingletonScope();
container
    .bind<Queue>(BindingKeys.ParsedQueue)
    .toDynamicValue(() => new Queue(bullMqConfig.queue.parsed, redisConfig))
    .inSingletonScope();
container
    .bind<Queue>(BindingKeys.TranslatedQueue)
    .toDynamicValue(() => new Queue(bullMqConfig.queue.translated, redisConfig))
    .inSingletonScope();

container.bind<ICsvStreamProcessor>(BindingKeys.ICsvStreamProcessor).to(CsvStreamProcessor).inSingletonScope();
container.bind<IUnasTranslator>(BindingKeys.IUnasTranslator).to(UnasTranslator).inSingletonScope();
container.bind<IAxiosHttpClient>(BindingKeys.IAxiosHttpClient).to(AxiosHttpClient).inSingletonScope();
container.bind<IUnasClient>(BindingKeys.IUnasClient).to(UnasClient).inSingletonScope();
container.bind<IDataSourceMapper>(BindingKeys.DataSourceMapper).to(DataSourceMapper).inSingletonScope();
container.bind<IUnasDataSourceMapper>(BindingKeys.UnasDataSourceMapper).to(UnasDataSourceMapper).inSingletonScope();
container.bind<IDataSourceRuleCollection>(BindingKeys.DataSourceRuleCollection).to(DataSourceRuleCollection).inSingletonScope();
container.bind<IDataSourceRuleProvider>(BindingKeys.DataSourceRuleProvider).to(DataSourceRuleProvider).inSingletonScope();

container.bind<IRepository<string>>(BindingKeys.ValidatedUrlsRepository).to(ValidatedUrlsRepository).inSingletonScope();
container.bind<IRepository<string>>(BindingKeys.SettingsRepository).to(SettingsRepository).inSingletonScope();
container.bind<ICacheRepository<IProductDto>>(BindingKeys.UnasCacheRepository).to(UnasCacheRepository).inSingletonScope();
container.bind<IRepository<WarehouseDto>>(BindingKeys.WarehouseRepository).to(WarehouseRepository).inSingletonScope();

container.bind<IDataConnector>(BindingKeys.FileDataConnector).to(FileDataConnector).inSingletonScope();
container.bind<IDataConnector>(BindingKeys.HttpDataConnector).to(HttpDataConnector).inSingletonScope();

export default container;
