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
}

export interface IMappingHistoryResponse {
  history: IMappingHistoryDto[];
}
