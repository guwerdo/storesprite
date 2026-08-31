import { injectable, inject } from "inversify";
import { EntityManager } from "@mikro-orm/postgresql";
import type { Logger } from "log4js";
import { User } from "../../entities/user/User.js";
import { DataConnection } from "../../entities/stocksprite/DataConnection.js";
import {
  IDataConnectionRepository,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
} from "../../types/stocksprite/DataConnectionRepository.interface.js";
import { TYPES } from "../../di/types.js";

@injectable()
export class DataConnectionRepository implements IDataConnectionRepository {
  constructor(
    @inject(TYPES.EntityManager)
    private readonly _em: EntityManager,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async getAllByUserId(userId: string): Promise<DataConnection[]> {
    this._logger?.info("Fetching all data connections for user", { userId });
    return this._em.find(
      DataConnection,
      { user: { id: userId } },
      { orderBy: { createdAt: "DESC" } }
    );
  }

  public async getByIdAndUserId(id: string, userId: string): Promise<DataConnection | null> {
    this._logger?.info("Fetching data connection by ID and user ID", { id, userId });
    return this._em.findOne(DataConnection, {
      id,
      user: { id: userId },
    });
  }

  public async getById(id: string): Promise<DataConnection | null> {
    this._logger?.info("Fetching data connection by ID", { id });
    return this._em.findOne(DataConnection, { id });
  }

  public async create(userId: string, data: CreateDataConnectionDto): Promise<DataConnection> {
    this._logger?.info("Creating data connection for user", { userId, name: data.name });

    let user = await this._em.findOne(User, { id: userId });
    if (!user) {
      user = new User(userId, `${userId}@clerk.user`);
      await this._em.persistAndFlush(user);
    }

    const connection = new DataConnection(
      user,
      data.name,
      data.channel,
      data.dataFormat,
      data.config,
      data.dataFormatConfig,
      data.isActive !== undefined ? data.isActive : false,
      data.credentials ?? null,
      data.testResult ?? null
    );

    await this._em.persistAndFlush(connection);
    this._logger?.info("Data connection created successfully", { id: connection.id, userId });
    return connection;
  }

  public async update(
    id: string,
    userId: string,
    data: UpdateDataConnectionDto
  ): Promise<DataConnection | null> {
    this._logger?.info("Updating data connection", { id, userId });

    const connection = await this.getByIdAndUserId(id, userId);
    if (!connection) {
      return null;
    }

    if (data.name !== undefined) {
      connection.name = data.name;
    }
    if (data.channel !== undefined) {
      connection.channel = data.channel;
    }
    if (data.dataFormat !== undefined) {
      connection.dataFormat = data.dataFormat;
    }
    if (data.config !== undefined) {
      connection.config = data.config;
    }
    if (data.dataFormatConfig !== undefined) {
      connection.dataFormatConfig = data.dataFormatConfig;
    }
    if (data.isActive !== undefined) {
      connection.isActive = data.isActive;
    }
    if (data.credentials !== undefined) {
      connection.credentials = data.credentials;
    }
    if (data.testResult !== undefined) {
      connection.testResult = data.testResult;
    }

    connection.updatedAt = new Date();
    await this._em.flush();
    this._logger?.info("Data connection updated successfully", { id, userId });
    return connection;
  }

  public async delete(id: string, userId: string): Promise<boolean> {
    this._logger?.info("Deleting data connection", { id, userId });

    const connection = await this.getByIdAndUserId(id, userId);
    if (!connection) {
      return false;
    }

    await this._em.removeAndFlush(connection);
    this._logger?.info("Data connection deleted successfully", { id, userId });
    return true;
  }
}
