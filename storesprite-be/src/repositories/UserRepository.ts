import { injectable, inject } from "inversify";
import { EntityManager } from "@mikro-orm/postgresql";
import type { Logger } from "log4js";
import { User } from "../entities/User.js";
import { IUserRepository, TYPES } from "../di/index.js";

@injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @inject(TYPES.EntityManager)
    private readonly _em: EntityManager,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  async getById(id: string): Promise<User | null> {
    this._logger?.info("Finding user by ID", { userId: id });
    return this._em.findOne(User, { id });
  }

  async getByEmail(email: string): Promise<User | null> {
    this._logger?.info("Finding user by email", { email });
    return this._em.findOne(User, { email });
  }

  async add(userData: Partial<User> & { id: string; email: string }): Promise<User> {
    this._logger?.info("Adding or updating user in database", { userId: userData.id, email: userData.email });
    const existing = await this.getById(userData.id);
    if (existing) {
      await this.update(existing.id, { email: userData.email, name: userData.name });
      return existing;
    }

    const user = new User(userData.id, userData.email, userData.name);
    if (userData.createdAt) user.createdAt = userData.createdAt;
    if (userData.updatedAt) user.updatedAt = userData.updatedAt;

    await this._em.persistAndFlush(user);
    this._logger?.info("New user persisted", { userId: user.id });
    return user;
  }

  async update(id: string, updates: Partial<Omit<User, "id" | "createdAt">>): Promise<User | null> {
    this._logger?.info("Updating user", { userId: id });
    const user = await this.getById(id);
    if (!user) {
      this._logger?.warn("User not found for update", { userId: id });
      return null;
    }

    if (updates.email !== undefined) {
      user.email = updates.email;
    }
    if (updates.name !== undefined) {
      user.name = updates.name;
    }
    user.updatedAt = new Date();

    await this._em.flush();
    this._logger?.info("User updated successfully", { userId: id });
    return user;
  }

  async delete(id: string): Promise<boolean> {
    this._logger?.info("Deleting user", { userId: id });
    const user = await this.getById(id);
    if (!user) {
      this._logger?.warn("User not found for deletion", { userId: id });
      return false;
    }

    await this._em.removeAndFlush(user);
    this._logger?.info("User deleted successfully", { userId: id });
    return true;
  }
}
