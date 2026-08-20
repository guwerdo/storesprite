import { Container } from "inversify";
import log4js from "log4js";
import { jsonWithDataFieldLayout } from "../log/index.js";
import { log4jsConfig } from "../config/log4js.config.js";
import { configuration } from "../config/configuration.js";
import { TYPES } from "./types.js";
import { UserService } from "../services/UserService.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { SettingService } from "../services/SettingService.js";
import { SettingRepository } from "../repositories/SettingRepository.js";
import { DataConnectionService } from "../services/DataConnectionService.js";
import { DataConnectionRepository } from "../repositories/DataConnectionRepository.js";
import type { MikroORM } from "@mikro-orm/postgresql";

log4js.addLayout("json-with-data-field", jsonWithDataFieldLayout);

export function createContainer(orm?: MikroORM): Container {
  const container = new Container();

  // Bind configuration instance
  container.bind(TYPES.IConfiguration).toConstantValue(configuration);

  // Configure and bind log4js structured Logger
  const logger = log4js.configure(log4jsConfig).getLogger("storesprite-be");
  container.bind<log4js.Logger>(TYPES.Logger).toConstantValue(logger);

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

  return container;
}
