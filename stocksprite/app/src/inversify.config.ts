import AjvModule, { Ajv } from "ajv";
import { Queue } from "bullmq";
import { Container } from "inversify";
import { Redis } from "ioredis";
import log4js from "log4js";
import path from "node:path";
import Client from "ssh2-sftp-client";

import { TEST_MODE, log4jsConfig, queueName, redisConfig } from "./config/config.js";
import { DataConnectorMock } from "./data-connector/data-connector-mock.js";
import { FileDataConnector, HttpDataConnector, IDataConnector, SftpDataConnector } from "./data-connector/index.js";
import { DataSourceMapper, IDataSourceMapper } from "./data-source/index.js";
import { AxiosHttpClient, IAxiosHttpClient } from "./http-client/index.js";
import { jsonWithDataFieldLayout } from "./log/index.js";
import { CsvStreamFactory, ICsvStreamFactory } from "./queue-publishers/index.js";
import { IQueuePublisher } from "./queue-publishers/interfaces/queue-publisher.interface.js";
import { QueuePublisher } from "./queue-publishers/queue-publisher.js";
import { ICacheRepository, IRepository, UnasCacheRepository, WarehouseRepository } from "./repository/index.js";
import { ProcessedItemsRepository, SettingsRepository, ValidatedUrlsRepository } from "./repository/index.js";
import { ISftpClient, SftpClient } from "./sftp-client/index.js";
import { BindingKeys } from "./types/index.js";
import { IUnasDataSourceMapper, UnasDataSourceMapper } from "./unas/cache/index.js";
import { IUnasClient, UnasClient, UnasClientMock } from "./unas/client/index.js";
import { ProductDto } from "./unas/dto/index.js";
import { WarehouseDto } from "./unas/dto/warehouse-dto.interface.js";
import { IUnasUpdater, UnasUpdater } from "./unas/updater/index.js";

const container = new Container();
const ajvImpl = AjvModule.default || AjvModule;

log4js.addLayout("json-with-data-field", jsonWithDataFieldLayout);
const mainFileName = path.basename(process.argv[1], path.extname(process.argv[1]));
container.bind<log4js.Logger>(BindingKeys.Logger).toConstantValue(log4js.configure(log4jsConfig).getLogger(mainFileName));
container.bind<Ajv>(BindingKeys.Ajv).toConstantValue(new ajvImpl({ allErrors: true, strict: false }));
container.bind<ICsvStreamFactory>(BindingKeys.ICsvStreamFactory).to(CsvStreamFactory).inSingletonScope();
container.bind<Client>(Client).toConstantValue(new Client());
container.bind<Redis>(BindingKeys.Redis).toConstantValue(new Redis({ host: redisConfig.connection.host, enableReadyCheck: true }));
container.bind<Queue>(Queue).toConstantValue(new Queue(queueName.main, redisConfig));

container.bind<IQueuePublisher>(BindingKeys.IQueuePublisher).to(QueuePublisher).inSingletonScope();
container.bind<IUnasUpdater>(BindingKeys.IUnasUpdater).to(UnasUpdater).inSingletonScope();
container.bind<IAxiosHttpClient>(BindingKeys.IAxiosHttpClient).to(AxiosHttpClient).inSingletonScope();
container.bind<IUnasClient>(BindingKeys.IUnasClient).to(UnasClient).inSingletonScope();
container.bind<ISftpClient>(BindingKeys.ISftpClient).to(SftpClient).inSingletonScope();
container.bind<IDataSourceMapper>(BindingKeys.DataSourceMapper).to(DataSourceMapper).inSingletonScope();
container.bind<IUnasDataSourceMapper>(BindingKeys.UnasDataSourceMapper).to(UnasDataSourceMapper).inSingletonScope();

container.bind<IRepository<string>>(BindingKeys.ProcessedItemsRepository).to(ProcessedItemsRepository).inSingletonScope();
container.bind<IRepository<string>>(BindingKeys.ValidatedUrlsRepository).to(ValidatedUrlsRepository).inSingletonScope();
container.bind<IRepository<string>>(BindingKeys.SettingsRepository).to(SettingsRepository).inSingletonScope();
container.bind<ICacheRepository<ProductDto>>(BindingKeys.UnasCacheRepository).to(UnasCacheRepository).inSingletonScope();
container.bind<IRepository<WarehouseDto>>(BindingKeys.WarehouseRepository).to(WarehouseRepository).inSingletonScope();

container.bind<IDataConnector>(BindingKeys.FileDataConnector).to(FileDataConnector).inSingletonScope();
container.bind<IDataConnector>(BindingKeys.HttpDataConnector).to(HttpDataConnector).inSingletonScope();
container.bind<IDataConnector>(BindingKeys.SftpDataConnector).to(SftpDataConnector).inSingletonScope();

if (TEST_MODE.DATA_CONNECTOR_MOCK) {
    container.rebindSync<IDataConnector>(BindingKeys.FileDataConnector).to(DataConnectorMock).inSingletonScope();
    container.rebindSync<IDataConnector>(BindingKeys.HttpDataConnector).to(DataConnectorMock).inSingletonScope();
    container.rebindSync<IDataConnector>(BindingKeys.SftpDataConnector).to(DataConnectorMock).inSingletonScope();
}

if (TEST_MODE.UNAS.CLIENT_MOCK) {
    container.rebindSync<IUnasClient>(BindingKeys.IUnasClient).to(UnasClientMock).inSingletonScope();
}

export default container;
