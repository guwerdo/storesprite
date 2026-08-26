export { User } from "../entities/User.js";
export { Language } from "../entities/Language.js";
export { UserSetting } from "../entities/UserSetting.js";
export { DataConnection } from "../entities/DataConnection.js";
export type { IUserRepository } from "../types/UserRepository.interface.js";
export type { IUserService } from "../types/UserService.interface.js";
export type { ISettingRepository } from "../types/SettingRepository.interface.js";
export type { ISettingService, UserSettingsDto, SaveUserSettingsDto } from "../types/SettingService.interface.js";
export type {
  IDataConnectionRepository,
  DataConnectionDto,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
  ConnectionConfig,
  DataFormatConfig,
} from "../types/DataConnectionRepository.interface.js";
export type { IDataConnectionService } from "../types/DataConnectionService.interface.js";
export type { IJsonSchemaValidator } from "../types/JsonSchemaValidator.interface.js";
export type { IConnectionTestRunnerService } from "../types/ConnectionTestRunnerService.interface.js";
export type { IUnasService } from "../types/UnasService.interface.js";
export type { IUnasClientFactory } from "../types/UnasClientFactory.interface.js";

export const TYPES = {
  IConfiguration: Symbol.for("IConfiguration"),
  IUserRepository: Symbol.for("IUserRepository"),
  IUserService: Symbol.for("IUserService"),
  ISettingRepository: Symbol.for("ISettingRepository"),
  ISettingService: Symbol.for("ISettingService"),
  IDataConnectionRepository: Symbol.for("IDataConnectionRepository"),
  IDataConnectionService: Symbol.for("IDataConnectionService"),
  IJsonSchemaValidator: Symbol.for("IJsonSchemaValidator"),
  IConnectionTestRunnerService: Symbol.for("IConnectionTestRunnerService"),
  IUnasService: Symbol.for("IUnasService"),
  IUnasClientFactory: Symbol.for("IUnasClientFactory"),
  EntityManager: Symbol.for("EntityManager"),
  MikroORM: Symbol.for("MikroORM"),
  Logger: Symbol.for("Logger"),
};
