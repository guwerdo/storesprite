import { injectable, inject } from "inversify";
import { EntityManager } from "@mikro-orm/postgresql";
import type { Logger } from "log4js";
import { Mapping } from "../../entities/stocksprite/Mapping.js";
import {
  HistoryStatus,
  HistoryTrigger,
  MappingHistory,
} from "../../entities/stocksprite/MappingHistory.js";
import { IMappingHistoryRepository } from "../../types/stocksprite/MappingHistoryRepository.interface.js";
import { TYPES } from "../../di/types.js";

@injectable()
export class MappingHistoryRepository implements IMappingHistoryRepository {
  constructor(
    @inject(TYPES.EntityManager)
    private readonly _em: EntityManager,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async create(mapping: Mapping, status: HistoryStatus, trigger: HistoryTrigger): Promise<MappingHistory> {
    this._logger?.info("Creating mapping history row", { mappingId: mapping.id, status, trigger });
    const history = new MappingHistory(mapping, status, trigger);
    await this._em.persistAndFlush(history);
    this._logger?.info("Mapping history row created", { historyId: history.id });
    return history;
  }

  public async findById(id: string): Promise<MappingHistory | null> {
    return this._em.findOne(MappingHistory, { id }, { populate: ["mapping"] });
  }

  public async save(history: MappingHistory): Promise<void> {
    this._logger?.info("Flushing mapping history row", { historyId: history.id, status: history.status });
    await this._em.flush();
  }

  public async markRunningAsFailed(mappingId: string, error: string): Promise<number> {
    const finishedAt = new Date();
    const count = await this._em.nativeUpdate(
      MappingHistory,
      { mapping: { id: mappingId }, status: "running" },
      { status: "failed", error, finishedAt }
    );
    this._logger?.info("Marked running history rows as failed", { mappingId, error, count });
    return count;
  }

  public async markStaleRunningFailed(olderThan: Date): Promise<number> {
    const finishedAt = new Date();
    const count = await this._em.nativeUpdate(
      MappingHistory,
      { status: "running", startedAt: { $lt: olderThan } },
      { status: "failed", error: "timeout", finishedAt }
    );
    this._logger?.info("Marked stale running history rows as failed (timeout)", { count });
    return count;
  }

  public async prune(mappingId: string, keep: number): Promise<number> {
    const rows = await this._em.find(
      MappingHistory,
      { mapping: { id: mappingId }, status: { $ne: "running" } },
      { orderBy: { startedAt: "DESC" }, fields: ["id"] }
    );
    if (rows.length <= keep) {
      return 0;
    }
    const toDelete = rows.slice(keep).map((row) => row.id);
    const count = await this._em.nativeDelete(MappingHistory, { id: { $in: toDelete } });
    this._logger?.info("Pruned mapping history rows", { mappingId, keep, deleted: count });
    return count;
  }

  public async listByMapping(mappingId: string): Promise<MappingHistory[]> {
    return this._em.find(
      MappingHistory,
      { mapping: { id: mappingId } },
      { orderBy: { startedAt: "DESC" }, populate: ["mapping"] }
    );
  }
}
