import type {
  MappingRule,
  MappingRuleDefinition,
  MappingRuleParamDefinition,
  StockMappingItem,
} from '@storesprite/mapping-rules';

/**
 * App-level aliases for the shared rule-engine types. The engine itself
 * (`applyRule` / `applyRules`) lives in @storesprite/mapping-rules so a rule
 * behaves identically in the editor preview, the backend and the processor.
 */
export type IMappingRule = MappingRule;
export type IMappingRuleDefinition = MappingRuleDefinition;
export type IMappingRuleParamDefinition = MappingRuleParamDefinition;
export type IStockMappingItem = StockMappingItem;

export type IMappingSchedule =
  | { frequency: 'once'; date: string; time: number }
  | { frequency: 'daily'; times: number[]; daysOfWeek?: number[] }
  | { frequency: 'monthly'; dayOfMonth: number; time: number };

export interface IMapping {
  id: string;
  name: string;
  scheduleEnabled: boolean;
  schedule?: IMappingSchedule | null;
  connectionId: string;
  skuField: string;
  skuRules?: IMappingRule[] | null;
  stockMappings: IStockMappingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ICreateMappingPayload {
  name: string;
  connectionId: string;
  skuField: string;
  skuRules?: IMappingRule[] | null;
  stockMappings: IStockMappingItem[];
}

export interface IUpdateMappingPayload {
  name?: string;
  connectionId?: string;
  skuField?: string;
  skuRules?: IMappingRule[] | null;
  stockMappings?: IStockMappingItem[];
  scheduleEnabled?: boolean;
  schedule?: IMappingSchedule | null;
}

export interface IMappingsApiResponse {
  mappings: IMapping[];
}

export interface IMappingMutationResponse {
  success: boolean;
  mapping?: IMapping;
  message?: string;
  error?: string;
}

export interface IMappingRulesResponse {
  rules: IMappingRuleDefinition[];
}

export type MappingRunStatus = 'running' | 'success' | 'partial' | 'failed';
export type MappingRunTrigger = 'schedule' | 'manual';

/** One `before → after` rewrite example from a single run's SKU normalization pass. */
export interface ISkuConversionExample {
  before: string;
  after: string;
}

/**
 * Summary of the SKU rewrites a processor run performed while feeding UNAS.
 * Mirrors the backend `SkuNormalizations` wire shape.
 */
export interface ISkuNormalizations {
  converted: {
    /** Total count of SKUs whose characters were rewritten (duplicates included). */
    count: number;
    /** Up to 5 distinct examples, each an original → normalized pair. */
    examples: ISkuConversionExample[];
  };
  truncated: {
    /** Total count of SKUs that exceeded the max length and were cut. */
    count: number;
    /** Up to 5 distinct original SKUs that were truncated. */
    examples: string[];
  };
}

/** Wire shape of one run-history row returned by `GET /client/stocksprite/mappings/:id/history`. */
export interface IMappingHistoryDto {
  id: string;
  mappingId: string;
  status: MappingRunStatus;
  trigger: MappingRunTrigger;
  /** ISO-8601 */
  startedAt: string;
  /** ISO-8601, or null while the run is still active */
  finishedAt: string | null;
  processedItems: number;
  updatedItems: number;
  unchangedItems: number;
  warningCount: number;
  errorCount: number;
  error: string | null;
  /** SKU normalization findings from the run, or null when none were surfaced. */
  skuNormalizations: ISkuNormalizations | null;
}

export interface IMappingHistoryResponse {
  history: IMappingHistoryDto[];
}
