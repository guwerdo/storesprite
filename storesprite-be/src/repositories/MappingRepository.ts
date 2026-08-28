import { injectable, inject } from "inversify";
import { EntityManager } from "@mikro-orm/postgresql";
import type { Logger } from "log4js";
import { User } from "../entities/User.js";
import { DataConnection } from "../entities/DataConnection.js";
import { Mapping } from "../entities/Mapping.js";
import {
  IMappingRepository,
  CreateMappingDto,
  UpdateMappingDto,
} from "../types/MappingRepository.interface.js";
import { TYPES } from "../di/types.js";

@injectable()
export class MappingRepository implements IMappingRepository {
  constructor(
    @inject(TYPES.EntityManager)
    private readonly _em: EntityManager,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async getAllByUserId(userId: string): Promise<Mapping[]> {
    this._logger?.info("Fetching all mappings for user", { userId });
    return this._em.find(
      Mapping,
      { user: { id: userId } },
      { orderBy: { createdAt: "DESC" } }
    );
  }

  public async getByIdAndUserId(id: string, userId: string): Promise<Mapping | null> {
    this._logger?.info("Fetching mapping by ID and user ID", { id, userId });
    return this._em.findOne(Mapping, { id, user: { id: userId } });
  }

  public async getById(id: string): Promise<Mapping | null> {
    this._logger?.info("Fetching mapping by ID", { id });
    return this._em.findOne(Mapping, { id });
  }

  public async getByConnectionIdAndUserId(connectionId: string, userId: string): Promise<Mapping | null> {
    this._logger?.info("Fetching mapping by connection ID and user ID", { connectionId, userId });
    return this._em.findOne(Mapping, {
      connection: { id: connectionId },
      user: { id: userId },
    });
  }

  public async create(userId: string, data: CreateMappingDto): Promise<Mapping> {
    this._logger?.info("Creating mapping for user", { userId, name: data.name });

    let user = await this._em.findOne(User, { id: userId });
    if (!user) {
      user = new User(userId, `${userId}@clerk.user`);
      await this._em.persistAndFlush(user);
    }

    const connection = this._em.getReference(DataConnection, data.connectionId);

    const mapping = new Mapping(
      user,
      connection,
      data.name,
      data.skuField,
      data.stockMappings,
      data.enabled ?? false,
      data.skuRules ?? null
    );

    await this._em.persistAndFlush(mapping);
    this._logger?.info("Mapping created successfully", { id: mapping.id, userId });
    return mapping;
  }

  public async update(id: string, userId: string, data: UpdateMappingDto): Promise<Mapping | null> {
    this._logger?.info("Updating mapping", { id, userId });

    const mapping = await this.getByIdAndUserId(id, userId);
    if (!mapping) {
      return null;
    }

    if (data.name !== undefined) {
      mapping.name = data.name;
    }
    if (data.enabled !== undefined) {
      mapping.enabled = data.enabled;
    }
    if (data.skuField !== undefined) {
      mapping.skuField = data.skuField;
    }
    if (data.skuRules !== undefined) {
      mapping.skuRules = data.skuRules;
    }
    if (data.stockMappings !== undefined) {
      mapping.stockMappings = data.stockMappings;
    }
    if (data.connectionId !== undefined) {
      mapping.connection = this._em.getReference(DataConnection, data.connectionId);
    }

    mapping.updatedAt = new Date();
    await this._em.flush();
    this._logger?.info("Mapping updated successfully", { id, userId });
    return mapping;
  }

  public async delete(id: string, userId: string): Promise<boolean> {
    this._logger?.info("Deleting mapping", { id, userId });

    const mapping = await this.getByIdAndUserId(id, userId);
    if (!mapping) {
      return false;
    }

    await this._em.removeAndFlush(mapping);
    this._logger?.info("Mapping deleted successfully", { id, userId });
    return true;
  }
}
