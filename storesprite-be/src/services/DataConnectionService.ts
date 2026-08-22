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
  ConnectionTestResult,
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

    // Check if test is currently in progress (within 15 minute timeout)
    if (
      existing.testResult?.progress &&
      ["start", "download", "convert"].includes(existing.testResult.progress)
    ) {
      const startedAt = existing.testResult.started_at
        ? new Date(existing.testResult.started_at).getTime()
        : 0;
      const isWithinTimeout = Date.now() - startedAt < 15 * 60 * 1000;
      if (isWithinTimeout) {
        const error = new Error("Cannot update connection while testing is in progress. Please wait for the test to complete.");
        (error as unknown as { statusCode: number }).statusCode = 409;
        throw error;
      }
    }

    // Smart comparison to detect if connection-related settings changed
    const hasConfigChanged =
      (data.channel !== undefined && data.channel !== existing.channel) ||
      (data.dataFormat !== undefined && data.dataFormat !== existing.dataFormat) ||
      (data.config !== undefined && JSON.stringify(data.config) !== JSON.stringify(existing.config)) ||
      (data.dataFormatConfig !== undefined && JSON.stringify(data.dataFormatConfig) !== JSON.stringify(existing.dataFormatConfig)) ||
      (data.credentials !== undefined && JSON.stringify(data.credentials) !== JSON.stringify(existing.credentials));

    let finalIsActive = data.isActive !== undefined ? data.isActive : existing.isActive;
    let finalTestResult = existing.testResult ?? null;

    if (hasConfigChanged) {
      // Deactivate and clear test results
      finalIsActive = false;
      finalTestResult = null;
    } else {
      // If user tries to activate connection without a passed test result
      if (data.isActive === true && existing.testResult?.success !== true) {
        throw new Error("Connection cannot be activated until it was tested successfully");
      }
    }

    const updated = await this._repository.update(id, userId, {
      ...data,
      name: data.name !== undefined ? data.name.trim() : undefined,
      config: validatedConfig,
      dataFormatConfig: validatedDataFormatConfig,
      credentials: validatedCredentials,
      isActive: finalIsActive,
      testResult: finalTestResult,
    });

    return updated ? this._mapToDto(updated) : null;
  }

  public async invalidateConnection(id: string, userId: string): Promise<boolean> {
    this._logger?.info("Service invalidating connection test result", { id, userId });
    if (!this._repository) {
      return false;
    }

    const existing = await this._repository.getByIdAndUserId(id, userId);
    if (!existing) {
      return false;
    }

    await this._repository.update(id, userId, {
      isActive: false,
      testResult: null,
    });

    return true;
  }

  public async saveTestResult(
    id: string,
    patchResult: Partial<ConnectionTestResult>
  ): Promise<DataConnectionDto | null> {
    this._logger?.info("Service saving connection test result", { id, progress: patchResult.progress });
    if (!this._repository) {
      return null;
    }

    const existing = await this._repository.getByIdAndUserId(id, (patchResult as unknown as { userId?: string }).userId ?? "");
    // If not found by user, retrieve via entity manager or search across users
    // For worker API, search by ID
    const connection = existing || (await this._repository.getByIdAndUserId(id, (existing as unknown as { user: { id: string } })?.user?.id || "")) || (await (this._repository as unknown as { _em: { findOne: (cls: unknown, filter: unknown) => Promise<DataConnection | null> } })._em?.findOne(DataConnection, { id }));
    
    if (!connection) {
      this._logger?.warn("Connection not found for saveTestResult", { id });
      return null;
    }

    const mergedTestResult: ConnectionTestResult = {
      ...(connection.testResult || {}),
      ...patchResult,
    };

    const validatedTestResult = this._validator.validateTestResult(mergedTestResult);

    connection.testResult = validatedTestResult;
    connection.updatedAt = new Date();
    await (this._repository as unknown as { _em: { flush: () => Promise<void> } })._em?.flush();

    return this._mapToDto(connection);
  }

  public async getConnectionByIdForWorker(id: string): Promise<DataConnectionDto | null> {
    this._logger?.info("Service fetching connection for worker", { id });
    if (!this._repository) {
      return null;
    }

    const connection = await (this._repository as unknown as { _em: { findOne: (cls: unknown, filter: unknown) => Promise<DataConnection | null> } })._em?.findOne(DataConnection, { id });
    return connection ? this._mapToDto(connection) : null;
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
      userId: entity.user?.id,
      name: entity.name,
      channel: entity.channel,
      dataFormat: entity.dataFormat,
      config: entity.config as unknown as ConnectionConfig,
      dataFormatConfig: entity.dataFormatConfig as unknown as DataFormatConfig,
      isActive: entity.isActive,
      credentials: entity.credentials,
      testResult: entity.testResult ?? null,
      createdAt: entity.createdAt instanceof Date ? entity.createdAt.toISOString() : String(entity.createdAt),
      updatedAt: entity.updatedAt instanceof Date ? entity.updatedAt.toISOString() : String(entity.updatedAt),
    };
  }
}
