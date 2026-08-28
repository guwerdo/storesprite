export interface IMappingRule {
  op: string;
  params: Record<string, string | number>;
}

export interface IStockMappingItem {
  column: string;
  warehouseId: number;
  rules?: IMappingRule[];
}

export interface IMapping {
  id: string;
  name: string;
  enabled: boolean;
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
  enabled?: boolean;
}

export interface IUpdateMappingPayload {
  name?: string;
  connectionId?: string;
  skuField?: string;
  skuRules?: IMappingRule[] | null;
  stockMappings?: IStockMappingItem[];
  enabled?: boolean;
}

export interface IMappingsApiResponse {
  mappings: IMapping[];
}

export interface IMappingApiResponse {
  mapping: IMapping;
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
