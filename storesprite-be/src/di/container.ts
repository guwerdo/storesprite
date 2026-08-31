import { Container } from "inversify";
import log4js from "log4js";
import { InMemoryTokenStore } from "@storesprite/unas-json-client";
import { jsonWithDataFieldLayout } from "../log/index.js";
import { log4jsConfig } from "../config/log4js.config.js";
import { configuration } from "../config/configuration.js";
import { TYPES } from "./types.js";
import { UserService } from "../services/UserService.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { SettingService } from "../services/SettingService.js";
import { SettingRepository } from "../repositories/SettingRepository.js";
import { DataConnectionService } from "../services/stocksprite/DataConnectionService.js";
import { DataConnectionRepository } from "../repositories/stocksprite/DataConnectionRepository.js";
import { MappingService } from "../services/stocksprite/MappingService.js";
import { MappingRepository } from "../repositories/stocksprite/MappingRepository.js";
import { ConnectionTestRunnerService } from "../services/stocksprite/ConnectionTestRunnerService.js";
import { UnasClientFactory } from "../services/UnasClientFactory.js";
import { UnasService } from "../services/UnasService.js";
import { JsonSchemaValidator } from "../utils/JsonSchemaValidator.js";
import type { MikroORM } from "@mikro-orm/postgresql";

log4js.addLayout("json-with-data-field", jsonWithDataFieldLayout);

export function createContainer(orm?: MikroORM): Container {
  const container = new Container();

  // Bind configuration instance
  container.bind(TYPES.IConfiguration).toConstantValue(configuration);

  // Configure and bind log4js structured Logger
  const logger = log4js.configure(log4jsConfig).getLogger("storesprite-be");
  container.bind<log4js.Logger>(TYPES.Logger).toConstantValue(logger);

  // Bind Schema Validator in singleton scope
  container.bind(TYPES.IJsonSchemaValidator).to(JsonSchemaValidator).inSingletonScope();

  // Bind Connection Test Runner Service
  container.bind(TYPES.IConnectionTestRunnerService).to(ConnectionTestRunnerService).inSingletonScope();

  // Shared app-owned UNAS token store, keyed per tenant (userId)
  container.bind(TYPES.ITokenStore).to(InMemoryTokenStore).inSingletonScope();

  // Bind UNAS client factory (singleton) and UNAS service (request scope)
  container.bind(TYPES.IUnasClientFactory).to(UnasClientFactory).inSingletonScope();
  container.bind(TYPES.IUnasService).to(UnasService).inRequestScope();

  // If MikroORM is initialized, bind the EntityManager factory or instance
  if (orm) {
    container.bind(TYPES.MikroORM).toConstantValue(orm);
    container.bind(TYPES.EntityManager).toDynamicValue(() => orm.em.fork());
  }

  // Bind repositories and services in request scope
  container.bind(TYPES.IUserRepository).to(UserRepository).inRequestScope();
  container.bind(TYPES.IUserService).to(UserService).inRequestScope();
  container.bind(TYPES.ISettingRepository).to(SettingRepository).inRequestScope();
  container.bind(TYPES.ISettingService).to(SettingService).inRequestScope();
  container.bind(TYPES.IDataConnectionRepository).to(DataConnectionRepository).inRequestScope();
  container.bind(TYPES.IDataConnectionService).to(DataConnectionService).inRequestScope();
  container.bind(TYPES.IMappingRepository).to(MappingRepository).inRequestScope();
  container.bind(TYPES.IMappingService).to(MappingService).inRequestScope();

  return container;
}
