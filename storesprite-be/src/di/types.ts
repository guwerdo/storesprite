export { User } from "../entities/User.js";
export { Language } from "../entities/Language.js";
export { UserSetting } from "../entities/UserSetting.js";
export { DataConnection } from "../entities/stocksprite/DataConnection.js";
export { Mapping } from "../entities/stocksprite/Mapping.js";
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
} from "../types/stocksprite/DataConnectionRepository.interface.js";
export type { IDataConnectionService } from "../types/stocksprite/DataConnectionService.interface.js";
export type {
  IMappingRepository,
  MappingDto,
  CreateMappingDto,
  UpdateMappingDto,
} from "../types/stocksprite/MappingRepository.interface.js";
export type { IMappingService } from "../types/stocksprite/MappingService.interface.js";
export type { IJsonSchemaValidator } from "../types/JsonSchemaValidator.interface.js";
export type { IConnectionTestRunnerService } from "../types/stocksprite/ConnectionTestRunnerService.interface.js";
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
  IMappingRepository: Symbol.for("IMappingRepository"),
  IMappingService: Symbol.for("IMappingService"),
  IJsonSchemaValidator: Symbol.for("IJsonSchemaValidator"),
  IConnectionTestRunnerService: Symbol.for("IConnectionTestRunnerService"),
  IUnasService: Symbol.for("IUnasService"),
  IUnasClientFactory: Symbol.for("IUnasClientFactory"),
  ITokenStore: Symbol.for("ITokenStore"),
  EntityManager: Symbol.for("EntityManager"),
  MikroORM: Symbol.for("MikroORM"),
  Logger: Symbol.for("Logger"),
};
