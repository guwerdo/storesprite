import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { DataConnection } from "../../entities/stocksprite/DataConnection.js";
import {
  IDataConnectionRepository,
  DataConnectionDto,
  CreateDataConnectionDto,
  UpdateDataConnectionDto,
  ConnectionConfig,
  DataFormatConfig,
  ConnectionTestResult,
} from "../../types/stocksprite/DataConnectionRepository.interface.js";
import { IDataConnectionService } from "../../types/stocksprite/DataConnectionService.interface.js";
import { IJsonSchemaValidator } from "../../types/JsonSchemaValidator.interface.js";
import { TYPES } from "../../di/types.js";
import { Util } from "../../utils/index.js";

@injectable()
export class DataConnectionService implements IDataConnectionService {
  constructor(
    @inject(TYPES.IDataConnectionRepository)
    private readonly _repository: IDataConnectionRepository,
    @inject(TYPES.IJsonSchemaValidator)
    private readonly _validator: IJsonSchemaValidator,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async getConnections(userId: string): Promise<DataConnectionDto[]> {
    this._logger?.info("Service fetching all data connections", { userId });
    const connections = await this._repository.getAllByUserId(userId);
    return connections.map((conn) => this._mapToDto(conn));
  }

  public async getConnectionById(id: string, userId: string): Promise<DataConnectionDto | null> {
    this._logger?.info("Service fetching connection by ID", { id, userId });
    const connection = await this._repository.getByIdAndUserId(id, userId);
    return connection ? this._mapToDto(connection) : null;
  }

  public async createConnection(userId: string, connectionDto: CreateDataConnectionDto): Promise<DataConnectionDto> {
    this._logger?.info("Service creating data connection", { userId, name: connectionDto.name });

    // Validate inputs
    this._assertValidName(connectionDto.name);

    const validatedConfig = this._validator.validateConfig(connectionDto.channel, connectionDto.config);
    const validatedDataFormatConfig = this._validator.validateDataFormatConfig(
      connectionDto.dataFormat,
      connectionDto.dataFormatConfig
    );
    const validatedCredentials = this._validator.validateCredentials(connectionDto.channel, connectionDto.credentials);

    const created = await this._repository.create(userId, {
      ...connectionDto,
      name: connectionDto.name.trim(),
      config: validatedConfig,
      dataFormatConfig: validatedDataFormatConfig,
      credentials: validatedCredentials,
    });

    return this._mapToDto(created);
  }

  public async updateConnection(
    id: string,
    userId: string,
    connectionDto: UpdateDataConnectionDto
  ): Promise<DataConnectionDto | null> {
    this._logger?.info("Service updating data connection", { id, userId });
    const existing = await this._repository.getByIdAndUserId(id, userId);
    if (!existing) {
      return null;
    }

    const channel = connectionDto.channel ?? existing.channel;
    const dataFormat = connectionDto.dataFormat ?? existing.dataFormat;

    let validatedConfig = connectionDto.config;
    if (connectionDto.config !== undefined || connectionDto.channel !== undefined) {
      validatedConfig = this._validator.validateConfig(
        channel,
        connectionDto.config !== undefined ? connectionDto.config : existing.config
      );
    }

    let validatedDataFormatConfig = connectionDto.dataFormatConfig;
    if (connectionDto.dataFormatConfig !== undefined || connectionDto.dataFormat !== undefined) {
      validatedDataFormatConfig = this._validator.validateDataFormatConfig(
        dataFormat,
        connectionDto.dataFormatConfig !== undefined ? connectionDto.dataFormatConfig : existing.dataFormatConfig
      );
    }

    let validatedCredentials = connectionDto.credentials;
    if (connectionDto.credentials !== undefined) {
      validatedCredentials = this._validator.validateCredentials(channel, connectionDto.credentials);
    }

    if (connectionDto.name !== undefined) {
      this._assertValidName(connectionDto.name);
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

    // Smart comparison to detect if connection-related settings (channel config, data format config, credentials) changed
    const hasChannelConfigChanged =
      (connectionDto.channel !== undefined && connectionDto.channel !== existing.channel) ||
      (connectionDto.config !== undefined && !Util.deepEqual(validatedConfig, existing.config));

    const hasDataFormatConfigChanged =
      (connectionDto.dataFormat !== undefined && connectionDto.dataFormat !== existing.dataFormat) ||
      (connectionDto.dataFormatConfig !== undefined && !Util.deepEqual(validatedDataFormatConfig, existing.dataFormatConfig));

    const hasCredentialsChanged =
      connectionDto.credentials !== undefined && !Util.deepEqual(validatedCredentials, existing.credentials);

    const hasConnectionSettingsChanged =
      hasChannelConfigChanged || hasDataFormatConfigChanged || hasCredentialsChanged;

    let finalIsActive = connectionDto.isActive !== undefined ? connectionDto.isActive : existing.isActive;
    let finalTestResult = existing.testResult ?? null;

    if (hasConnectionSettingsChanged) {
      this._logger?.info("Connection settings changed, invalidating test result and active status", { id, userId });
      // Deactivate and clear test results
      finalIsActive = false;
      finalTestResult = null;
    } else {
      // If user tries to activate connection without a passed test result
      if (connectionDto.isActive === true && existing.testResult?.success !== true) {
        throw new Error("Connection cannot be activated until it was tested successfully");
      }
    }

    const updated = await this._repository.update(id, userId, {
      ...connectionDto,
      name: connectionDto.name !== undefined ? connectionDto.name.trim() : undefined,
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
    const connection = await this._repository.getById(id);
    if (!connection) {
      this._logger?.warn("Connection not found for saveTestResult", { id });
      return null;
    }

    const mergedTestResult: ConnectionTestResult = {
      ...(connection.testResult || {}),
      ...patchResult,
    };

    const validatedTestResult = this._validator.validateTestResult(mergedTestResult);

    const updated = await this._repository.update(id, connection.user.id, { testResult: validatedTestResult });
    return updated ? this._mapToDto(updated) : null;
  }

  public async getConnectionByIdForWorker(id: string): Promise<DataConnectionDto | null> {
    this._logger?.info("Service fetching connection for worker", { id });
    const connection = await this._repository.getById(id);
    return connection ? this._mapToDto(connection) : null;
  }

  public async deleteConnection(id: string, userId: string): Promise<boolean> {
    this._logger?.info("Service deleting data connection", { id, userId });
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
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private _assertValidName(name: string): void {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Connection name is required");
    }
    if (name.length > 255) {
      throw new Error("Connection name cannot exceed 255 characters");
    }
  }
}
