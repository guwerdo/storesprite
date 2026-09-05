export { User } from "../entities/user/User.js";
export { Language } from "../entities/user/Language.js";
export { UserSetting } from "../entities/user/UserSetting.js";
export { DataConnection } from "../entities/stocksprite/DataConnection.js";
export { Mapping } from "../entities/stocksprite/Mapping.js";
export { MappingHistory } from "../entities/stocksprite/MappingHistory.js";
export type { IUserRepository } from "../types/user/UserRepository.interface.js";
export type { IUserService } from "../types/user/UserService.interface.js";
export type { ISettingRepository } from "../types/user/SettingRepository.interface.js";
export type { ISettingService, UserSettingsDto, SaveUserSettingsDto } from "../types/user/SettingService.interface.js";
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
export type {
  IMappingHistoryRepository,
  MappingHistoryDto,
  SkuNormalizations,
  SkuConversionExample,
} from "../types/stocksprite/MappingHistoryRepository.interface.js";
export type { IMappingService } from "../types/stocksprite/MappingService.interface.js";
export type { ISchedulerService } from "../types/stocksprite/SchedulerService.interface.js";
export type { IJsonSchemaValidator } from "../types/JsonSchemaValidator.interface.js";
export type { IConnectionTestRunnerService } from "../types/stocksprite/ConnectionTestRunnerService.interface.js";
export type { IUnasService } from "../types/unas/UnasService.interface.js";
export type { IUnasClientFactory } from "../types/unas/UnasClientFactory.interface.js";

export const TYPES = {
  IConfiguration: Symbol.for("IConfiguration"),
  IUserRepository: Symbol.for("IUserRepository"),
  IUserService: Symbol.for("IUserService"),
  ISettingRepository: Symbol.for("ISettingRepository"),
  ISettingService: Symbol.for("ISettingService"),
  IDataConnectionRepository: Symbol.for("IDataConnectionRepository"),
  IDataConnectionService: Symbol.for("IDataConnectionService"),
  IMappingRepository: Symbol.for("IMappingRepository"),
  IMappingHistoryRepository: Symbol.for("IMappingHistoryRepository"),
  IMappingService: Symbol.for("IMappingService"),
  ISchedulerService: Symbol.for("ISchedulerService"),
  IJsonSchemaValidator: Symbol.for("IJsonSchemaValidator"),
  IConnectionTestRunnerService: Symbol.for("IConnectionTestRunnerService"),
  IUnasService: Symbol.for("IUnasService"),
  IUnasClientFactory: Symbol.for("IUnasClientFactory"),
  ITokenStore: Symbol.for("ITokenStore"),
  EntityManager: Symbol.for("EntityManager"),
  MikroORM: Symbol.for("MikroORM"),
  Logger: Symbol.for("Logger"),
};
