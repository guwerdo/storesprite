import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { DataConnection } from "../entities/DataConnection.js";
import {
  IDataConnectionRepository,
  DataConnectionDto,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
  ConnectionConfig,
  DataFormatConfig,
} from "../types/DataConnectionRepository.interface.js";
import { IDataConnectionService } from "../types/DataConnectionService.interface.js";
import { IJsonSchemaValidator } from "../types/JsonSchemaValidator.interface.js";
import { TYPES } from "../di/types.js";
import { JsonSchemaValidator } from "../utils/JsonSchemaValidator.js";

@injectable()
export class DataConnectionService implements IDataConnectionService {
  private readonly _validator: IJsonSchemaValidator;

  constructor(
    @inject(TYPES.IDataConnectionRepository)
    private readonly _repository?: IDataConnectionRepository,
    @inject(TYPES.IJsonSchemaValidator)
    validator?: IJsonSchemaValidator,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {
    this._validator = validator || new JsonSchemaValidator();
  }

  public async getConnections(userId: string): Promise<DataConnectionDto[]> {
    this._logger?.info("Service fetching all data connections", { userId });
    if (!this._repository) {
      this._logger?.warn("DataConnectionRepository unavailable");
      return [];
    }

    const connections = await this._repository.getAllByUserId(userId);
    return connections.map((conn) => this._mapToDto(conn));
  }

  public async getConnectionById(id: string, userId: string): Promise<DataConnectionDto | null> {
    this._logger?.info("Service fetching connection by ID", { id, userId });
    if (!this._repository) {
      this._logger?.warn("DataConnectionRepository unavailable");
      return null;
    }

    const connection = await this._repository.getByIdAndUserId(id, userId);
    return connection ? this._mapToDto(connection) : null;
  }

  public async createConnection(userId: string, data: CreateDataConnectionDto): Promise<DataConnectionDto> {
    this._logger?.info("Service creating data connection", { userId, name: data.name });
    if (!this._repository) {
      this._logger?.warn("DataConnectionRepository unavailable");
      throw new Error("DataConnectionRepository unavailable");
    }

    // Validate inputs
    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      throw new Error("Connection name is required");
    }
    if (data.name.length > 255) {
      throw new Error("Connection name cannot exceed 255 characters");
    }

    const validatedConfig = this._validator.validateConfig(data.channel, data.config);
    const validatedDataFormatConfig = this._validator.validateDataFormatConfig(
      data.dataFormat,
      data.dataFormatConfig
    );
    const validatedCredentials = this._validator.validateCredentials(data.channel, data.credentials);

    const created = await this._repository.create(userId, {
      ...data,
      name: data.name.trim(),
      config: validatedConfig,
      dataFormatConfig: validatedDataFormatConfig,
      credentials: validatedCredentials,
    });

    return this._mapToDto(created);
  }

  public async updateConnection(
    id: string,
    userId: string,
    data: UpdateDataConnectionDto
  ): Promise<DataConnectionDto | null> {
    this._logger?.info("Service updating data connection", { id, userId });
    if (!this._repository) {
      this._logger?.warn("DataConnectionRepository unavailable");
      throw new Error("DataConnectionRepository unavailable");
    }

    const existing = await this._repository.getByIdAndUserId(id, userId);
    if (!existing) {
      return null;
    }

    const channel = data.channel ?? existing.channel;
    const dataFormat = data.dataFormat ?? existing.dataFormat;

    let validatedConfig = data.config;
    if (data.config !== undefined || data.channel !== undefined) {
      validatedConfig = this._validator.validateConfig(
        channel,
        data.config !== undefined ? data.config : existing.config
      );
    }

    let validatedDataFormatConfig = data.dataFormatConfig;
    if (data.dataFormatConfig !== undefined || data.dataFormat !== undefined) {
      validatedDataFormatConfig = this._validator.validateDataFormatConfig(
        dataFormat,
        data.dataFormatConfig !== undefined ? data.dataFormatConfig : existing.dataFormatConfig
      );
    }

    let validatedCredentials = data.credentials;
    if (data.credentials !== undefined) {
      validatedCredentials = this._validator.validateCredentials(channel, data.credentials);
    }

    if (data.name !== undefined) {
      if (typeof data.name !== "string" || data.name.trim().length === 0) {
        throw new Error("Connection name is required");
      }
      if (data.name.length > 255) {
        throw new Error("Connection name cannot exceed 255 characters");
      }
    }

    const updated = await this._repository.update(id, userId, {
      ...data,
      name: data.name !== undefined ? data.name.trim() : undefined,
      config: validatedConfig,
      dataFormatConfig: validatedDataFormatConfig,
      credentials: validatedCredentials,
    });

    return updated ? this._mapToDto(updated) : null;
  }

  public async deleteConnection(id: string, userId: string): Promise<boolean> {
    this._logger?.info("Service deleting data connection", { id, userId });
    if (!this._repository) {
      this._logger?.warn("DataConnectionRepository unavailable");
      return false;
    }

    return this._repository.delete(id, userId);
  }

  private _mapToDto(entity: DataConnection): DataConnectionDto {
    return {
      id: entity.id,
      name: entity.name,
      channel: entity.channel,
      dataFormat: entity.dataFormat,
      config: entity.config as unknown as ConnectionConfig,
      dataFormatConfig: entity.dataFormatConfig as unknown as DataFormatConfig,
      isActive: entity.isActive,
      credentials: entity.credentials,
      createdAt: entity.createdAt instanceof Date ? entity.createdAt.toISOString() : String(entity.createdAt),
      updatedAt: entity.updatedAt instanceof Date ? entity.updatedAt.toISOString() : String(entity.updatedAt),
    };
  }
}
