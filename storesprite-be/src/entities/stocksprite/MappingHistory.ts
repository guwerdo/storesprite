import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { Mapping } from "./Mapping.js";
import type { SkuNormalizations } from "../../types/stocksprite/MappingHistoryRepository.interface.js";

export type HistoryStatus = "running" | "success" | "partial" | "failed";
export type HistoryTrigger = "schedule" | "manual";

@Entity({ tableName: "stocksprite_history" })
export class MappingHistory {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @ManyToOne(() => Mapping, { deleteRule: "cascade" })
  mapping!: Mapping;

  @Property({ type: "varchar", length: 20 })
  status: HistoryStatus = "running";

  // "trigger" is a non-reserved SQL keyword; valid as a column name
  @Property({ type: "varchar", length: 20 })
  trigger: HistoryTrigger = "schedule";

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP" })
  startedAt: Date = new Date();

  @Property({ type: "timestamptz", nullable: true })
  finishedAt?: Date | null;

  @Property({ type: "integer", default: 0 }) processedItems = 0;
  @Property({ type: "integer", default: 0 }) updatedItems = 0;
  @Property({ type: "integer", default: 0 }) unchangedItems = 0;
  @Property({ type: "integer", default: 0 }) warningCount = 0;
  @Property({ type: "integer", default: 0 }) errorCount = 0;

  @Property({ type: "text", nullable: true })
  error?: string | null;

  @Property({ type: "jsonb", nullable: true })
  skuNormalizations?: SkuNormalizations | null;

  @Property({ type: "timestamptz", defaultRaw: "CURRENT_TIMESTAMP", onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(mapping: Mapping, status: HistoryStatus, trigger: HistoryTrigger) {
    this.mapping = mapping;
    this.status = status;
    this.trigger = trigger;
  }
}
