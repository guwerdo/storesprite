import { Mapping } from "../../entities/stocksprite/Mapping.js";
import {
  HistoryStatus,
  HistoryTrigger,
  MappingHistory,
} from "../../entities/stocksprite/MappingHistory.js";

export interface IMappingHistoryRepository {
  create(mapping: Mapping, status: HistoryStatus, trigger: HistoryTrigger): Promise<MappingHistory>;
  /** populate: ["mapping"] */
  findById(id: string): Promise<MappingHistory | null>;
  /** em.flush() on an already-managed row */
  save(history: MappingHistory): Promise<void>;
  markRunningAsFailed(mappingId: string, error: string): Promise<number>;
  markStaleRunningFailed(olderThan: Date): Promise<number>;
  prune(mappingId: string, keep: number): Promise<number>;
  /** populate: ["mapping"]; order: startedAt DESC */
  listByMapping(mappingId: string): Promise<MappingHistory[]>;
}

/** Wire shape of one `before -> after` SKU conversion example. */
export interface SkuConversionExample {
  before: string;
  after: string;
}

/**
 * SKU normalizations applied while parsing the supplier CSV, carried on the
 * `finish` progress report and persisted on the run-history row. Hand-synced
 * with stocksprite (processor) and storesprite-fe (field names must stay
 * identical across the three).
 */
export interface SkuNormalizations {
  converted: {
    /** @asType integer @minimum 0 */
    count: number;
    /** @maxItems 5 */
    examples: SkuConversionExample[];
  };
  truncated: {
    /** @asType integer @minimum 0 */
    count: number;
    /** @maxItems 5 */
    examples: string[];
  };
}

/** Wire shape of a run-history row returned by `GET /mappings/:id/history`. */
export interface MappingHistoryDto {
  id: string;
  mappingId: string;
  status: HistoryStatus;
  trigger: HistoryTrigger;
  /** ISO-8601 */
  startedAt: string;
  /** ISO-8601 or null when the run has not finished */
  finishedAt: string | null;
  processedItems: number;
  updatedItems: number;
  unchangedItems: number;
  warningCount: number;
  errorCount: number;
  error: string | null;
  skuNormalizations: SkuNormalizations | null;
}
