import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { Mapping } from "../entities/Mapping.js";
import {
  IMappingRepository,
  MappingDto,
  CreateMappingDto,
  UpdateMappingDto,
  StockMappingItem,
  MappingRule,
  MappingSchedule,
} from "../types/MappingRepository.interface.js";
import { IMappingService } from "../types/MappingService.interface.js";
import { IDataConnectionRepository } from "../types/DataConnectionRepository.interface.js";
import { IJsonSchemaValidator } from "../types/JsonSchemaValidator.interface.js";
import { MAPPING_RULES, MappingRuleGroup, MappingRuleDefinition } from "../config/mapping-rules.js";
import { TYPES } from "../di/types.js";

@injectable()
export class MappingService implements IMappingService {
  constructor(
    @inject(TYPES.IMappingRepository)
    private readonly _repository: IMappingRepository,
    @inject(TYPES.IDataConnectionRepository)
    private readonly _dataConnectionRepository: IDataConnectionRepository,
    @inject(TYPES.IJsonSchemaValidator)
    private readonly _validator: IJsonSchemaValidator,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async getMappings(userId: string): Promise<MappingDto[]> {
    this._logger?.info("Service fetching all mappings", { userId });
    const mappings = await this._repository.getAllByUserId(userId);
    return mappings.map((m) => this._mapToDto(m));
  }

  public async getMappingById(id: string, userId: string): Promise<MappingDto | null> {
    this._logger?.info("Service fetching mapping by ID", { id, userId });
    const mapping = await this._repository.getByIdAndUserId(id, userId);
    return mapping ? this._mapToDto(mapping) : null;
  }

  public async createMapping(userId: string, dto: CreateMappingDto): Promise<MappingDto> {
    this._logger?.info("Service creating mapping", { userId, name: dto.name });

    this._assertValidName(dto.name);
    await this._assertTestedConnection(dto.connectionId, userId);
    this._assertNonEmpty(dto.skuField, "SKU field is required");

    const stockMappings = this._validator.validateStockMappings(dto.stockMappings);
    const skuRules = this._validator.validateMappingRules(dto.skuRules ?? []);

    this._validateRuleList(skuRules, "sku");
    this._validateRules(stockMappings, "stock");
    await this._assertNoMappingForConnection(dto.connectionId, userId);
    this._validateNoDuplicates(stockMappings);

    const created = await this._repository.create(userId, {
      ...dto,
      name: dto.name.trim(),
      skuField: dto.skuField.trim(),
      stockMappings,
      skuRules: skuRules.length > 0 ? skuRules : null,
    });

    return this._mapToDto(created);
  }

  public async updateMapping(id: string, userId: string, dto: UpdateMappingDto): Promise<MappingDto | null> {
    this._logger?.info("Service updating mapping", { id, userId });
    const existing = await this._repository.getByIdAndUserId(id, userId);
    if (!existing) {
      return null;
    }

    if (dto.name !== undefined) {
      this._assertValidName(dto.name);
    }
    if (dto.connectionId !== undefined) {
      await this._assertTestedConnection(dto.connectionId, userId);
      await this._assertNoMappingForConnection(dto.connectionId, userId, id);
    }
    if (dto.skuField !== undefined) {
      this._assertNonEmpty(dto.skuField, "SKU field is required");
    }

    let stockMappings: StockMappingItem[] | undefined;
    if (dto.stockMappings !== undefined) {
      stockMappings = this._validator.validateStockMappings(dto.stockMappings);
      this._validateRules(stockMappings, "stock");
      this._validateNoDuplicates(stockMappings);
    }

    let skuRules: MappingRule[] | undefined;
    if (dto.skuRules !== undefined) {
      skuRules = this._validator.validateMappingRules(dto.skuRules ?? []);
      this._validateRuleList(skuRules, "sku");
    }

    let schedule: MappingSchedule | null | undefined;
    if (dto.schedule !== undefined) {
      schedule = dto.schedule === null ? null : this._validateSchedule(dto.schedule);
    }

    const scheduleEnabled = dto.scheduleEnabled ?? existing.scheduleEnabled;
    const resultingSchedule = schedule !== undefined ? schedule : existing.schedule;
    if (scheduleEnabled && (resultingSchedule === null || resultingSchedule === undefined)) {
      throw new Error("Cannot enable a schedule without a schedule configuration");
    }

    const updated = await this._repository.update(id, userId, {
      ...dto,
      name: dto.name !== undefined ? dto.name.trim() : undefined,
      skuField: dto.skuField !== undefined ? dto.skuField.trim() : undefined,
      stockMappings,
      skuRules: skuRules !== undefined ? (skuRules.length > 0 ? skuRules : null) : undefined,
      schedule,
    });

    return updated ? this._mapToDto(updated) : null;
  }

  public async deleteMapping(id: string, userId: string): Promise<boolean> {
    this._logger?.info("Service deleting mapping", { id, userId });
    return this._repository.delete(id, userId);
  }

  public async runMapping(id: string, userId: string): Promise<boolean> {
    this._logger?.info("Service running mapping", { id, userId });
    const mapping = await this._repository.getByIdAndUserId(id, userId);
    if (!mapping) {
      return false;
    }
    this._logger?.info("Mapping run requested (execution not yet implemented)", { id, userId });
    return true;
  }

  private _mapToDto(entity: Mapping): MappingDto {
    return {
      id: entity.id,
      userId: entity.user?.id,
      name: entity.name,
      scheduleEnabled: entity.scheduleEnabled,
      schedule: entity.schedule ?? null,
      connectionId: entity.connection?.id,
      skuField: entity.skuField,
      skuRules: entity.skuRules ?? null,
      stockMappings: entity.stockMappings,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private async _assertTestedConnection(connectionId: string, userId: string): Promise<void> {
    const connection = await this._dataConnectionRepository.getByIdAndUserId(connectionId, userId);
    if (!connection) {
      throw new Error("Connection not found");
    }
    if (
      connection.testResult?.success !== true ||
      !connection.testResult.columns ||
      connection.testResult.columns.length === 0
    ) {
      throw new Error("Connection must be tested before creating a mapping");
    }
  }

  private async _assertNoMappingForConnection(connectionId: string, userId: string, excludeMappingId?: string): Promise<void> {
    const existing = await this._repository.getByConnectionIdAndUserId(connectionId, userId);
    if (existing && existing.id !== excludeMappingId) {
      throw new Error("Only one mapping can be created per connection");
    }
  }

  private _validateNoDuplicates(items: StockMappingItem[]): void {
    const columns = new Set<string>();
    const warehouses = new Set<number>();
    for (const item of items) {
      if (columns.has(item.column)) {
        throw new Error(`Duplicate column mapping: ${item.column}`);
      }
      columns.add(item.column);

      if (warehouses.has(item.warehouseId)) {
        throw new Error(`Duplicate warehouse mapping: ${item.warehouseId}`);
      }
      warehouses.add(item.warehouseId);
    }
  }

  private _validateRules(items: StockMappingItem[], group: MappingRuleGroup): void {
    for (const item of items) {
      this._validateRuleList(item.rules, group);
    }
  }

  private _validateRuleList(rules: MappingRule[] | null | undefined, group: MappingRuleGroup): void {
    if (!rules || rules.length === 0) {
      return;
    }
    for (const rule of rules) {
      const def = MAPPING_RULES.find((r) => r.op === rule.op);
      if (!def) {
        throw new Error(`Unknown rule operation: ${rule.op}`);
      }
      if (!def.groups.includes(group)) {
        throw new Error(`Rule operation '${rule.op}' is not available in the '${group}' group`);
      }
      this._assertParams(rule, def);
    }
  }

  private _assertParams(rule: MappingRule, def: MappingRuleDefinition): void {
    const provided = Object.keys(rule.params ?? {});
    const expected = def.params.map((p) => p.name);

    for (const name of expected) {
      if (!provided.includes(name)) {
        throw new Error(`Rule '${rule.op}' is missing parameter '${name}'`);
      }
    }
    for (const name of provided) {
      if (!expected.includes(name)) {
        throw new Error(`Rule '${rule.op}' has unexpected parameter '${name}'`);
      }
      const paramDef = def.params.find((p) => p.name === name) as MappingRuleDefinition["params"][number];
      const value = rule.params[name];
      if (paramDef.type === "number" && typeof value !== "number") {
        throw new Error(`Rule '${rule.op}' parameter '${name}' must be a number`);
      }
      if (paramDef.type === "string" && typeof value !== "string") {
        throw new Error(`Rule '${rule.op}' parameter '${name}' must be a string`);
      }
    }
  }

  private _assertNonEmpty(value: string, message: string): void {
    if (!value.trim()) {
      throw new Error(message);
    }
  }

  private _assertValidName(name: string): void {
    this._assertNonEmpty(name, "Mapping name is required");
    if (name.length > 255) {
      throw new Error("Mapping name cannot exceed 255 characters");
    }
  }

  private _validateSchedule(schedule: MappingSchedule): MappingSchedule {
    if (!schedule || typeof schedule !== "object") {
      throw new Error("Schedule must be an object");
    }
    const s = schedule as unknown as Record<string, unknown>;
    switch (s.frequency) {
      case "once": {
        const date = s.date;
        if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error("Schedule 'once' requires a valid date (YYYY-MM-DD)");
        }
        if (Number.isNaN(new Date(date).getTime())) {
          throw new Error("Schedule 'once' has an invalid date");
        }
        return { frequency: "once", date, time: this._validateHour(s.time, "once") };
      }
      case "daily": {
        const times = this._validateIntArray(s.times, "hours", 0, 23);
        const daysOfWeek = this._validateOptionalDaysOfWeek(s.daysOfWeek);
        return daysOfWeek ? { frequency: "daily", times, daysOfWeek } : { frequency: "daily", times };
      }
      case "monthly": {
        const dayOfMonth = s.dayOfMonth;
        if (!Number.isInteger(dayOfMonth) || (dayOfMonth as number) < 1 || (dayOfMonth as number) > 31) {
          throw new Error("Schedule 'monthly' requires a day of month (1-31)");
        }
        return { frequency: "monthly", dayOfMonth: dayOfMonth as number, time: this._validateHour(s.time, "monthly") };
      }
      default:
        throw new Error(`Unknown schedule frequency: ${String(s.frequency)}`);
    }
  }

  private _validateHour(value: unknown, label: string): number {
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 23) {
      throw new Error(`Schedule '${label}' requires an hour (0-23)`);
    }
    return value as number;
  }

  private _validateIntArray(value: unknown, label: string, min: number, max: number): number[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`Schedule ${label} must be a non-empty array`);
    }
    const items = value as number[];
    const seen = new Set<number>();
    for (const item of items) {
      if (!Number.isInteger(item) || item < min || item > max) {
        throw new Error(`Schedule ${label} must be integers in ${min}-${max}`);
      }
      if (seen.has(item)) {
        throw new Error(`Schedule ${label} must not contain duplicates`);
      }
      seen.add(item);
    }
    return items;
  }

  private _validateOptionalDaysOfWeek(value: unknown): number[] | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      throw new Error("Schedule daysOfWeek must be an array");
    }
    if (value.length === 0) {
      return undefined; // empty = every day
    }
    return this._validateIntArray(value, "daysOfWeek", 0, 6);
  }
}
