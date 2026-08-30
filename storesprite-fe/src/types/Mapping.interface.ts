export interface IMappingRule {
  op: string;
  params: Record<string, string | number>;
}

export interface IStockMappingItem {
  column: string;
  warehouseId: number;
  rules?: IMappingRule[];
}

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

export interface IMappingRuleParamDefinition {
  name: string;
  type: 'number' | 'string';
}

export interface IMappingRuleDefinition {
  op: string;
  groups: string[];
  params: IMappingRuleParamDefinition[];
}

export interface IMappingRulesResponse {
  rules: IMappingRuleDefinition[];
}
