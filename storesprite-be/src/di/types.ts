export { User } from "../entities/User.js";
export { Language } from "../entities/Language.js";
export { UserSetting } from "../entities/UserSetting.js";
export type { IUserRepository } from "../types/UserRepository.interface.js";
export type { IUserService } from "../types/UserService.interface.js";
export type { ISettingRepository } from "../types/SettingRepository.interface.js";
export type { ISettingService, UserSettingsDto, SaveUserSettingsDto } from "../types/SettingService.interface.js";

export const TYPES = {
  IUserRepository: Symbol.for("IUserRepository"),
  IUserService: Symbol.for("IUserService"),
  ISettingRepository: Symbol.for("ISettingRepository"),
  ISettingService: Symbol.for("ISettingService"),
  EntityManager: Symbol.for("EntityManager"),
  MikroORM: Symbol.for("MikroORM"),
  Logger: Symbol.for("Logger"),
};
