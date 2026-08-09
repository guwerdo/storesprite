import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { IUserService, IUserRepository, User, TYPES } from "../di/index.js";

@injectable()
export class UserService implements IUserService {
  constructor(
    @inject(TYPES.IUserRepository)
    private readonly _userRepository?: IUserRepository,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  async getUserById(id: string): Promise<User | null> {
    this._logger?.info("Fetching user by id", { userId: id });
    if (this._userRepository) {
      return this._userRepository.getById(id);
    }
    this._logger?.warn("User repository unavailable when fetching user", { userId: id });
    return null;
  }

  async createUser(id: string, email: string, name?: string): Promise<User> {
    this._logger?.info("Creating user", { userId: id, email, name });
    if (this._userRepository) {
      return this._userRepository.add({ id, email, name });
    }
    this._logger?.warn("User repository unavailable when creating user, returning transient instance", { userId: id, email });
    return new User(id, email, name);
  }
}
