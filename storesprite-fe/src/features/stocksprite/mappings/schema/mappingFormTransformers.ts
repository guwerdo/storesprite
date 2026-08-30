import type {
  IMapping,
  IMappingRule,
  ICreateMappingPayload,
  IMappingRuleDefinition,
} from '../../../../types/Mapping.interface.js';
import {
  MappingFormValues,
  defaultMappingFormValues,
  RuleFormValue,
} from './mappingFormSchema.js';

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

function ruleToForm(rule: IMappingRule): RuleFormValue {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(rule.params ?? {})) {
    params[key] = String(value);
  }
  return { op: rule.op, params };
}

function ruleToApi(rule: RuleFormValue, rulesDict: IMappingRuleDefinition[]): IMappingRule | null {
  if (!rule.op) {
    return null;
  }
  const def = rulesDict.find((d) => d.op === rule.op);
  const params: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(rule.params ?? {})) {
    const paramDef = def?.params.find((p) => p.name === key);
    params[key] = paramDef?.type === 'number' ? Number(raw) : raw;
  }
  return { op: rule.op, params };
}

export function toFormValues(mapping?: IMapping | null): MappingFormValues {
  if (!mapping) {
    return { ...defaultMappingFormValues };
  }

  return {
    name: asString(mapping.name),
    connectionId: asString(mapping.connectionId),
    skuField: asString(mapping.skuField),
    skuRules: (mapping.skuRules ?? []).map((r) => ruleToForm(r)),
    stockMappings: (mapping.stockMappings ?? []).map((item) => ({
      column: asString(item.column),
      warehouseId: item.warehouseId !== undefined ? String(item.warehouseId) : '',
      rules: (item.rules ?? []).map((r) => ruleToForm(r)),
    })),
  };
}

export function toApiPayload(values: MappingFormValues, rulesDict: IMappingRuleDefinition[]): ICreateMappingPayload {
  return {
    name: values.name.trim(),
    connectionId: values.connectionId,
    skuField: values.skuField.trim(),
    skuRules: values.skuRules
      .map((r) => ruleToApi(r, rulesDict))
      .filter((r): r is IMappingRule => r !== null),
    stockMappings: values.stockMappings.map((item) => ({
      column: item.column,
      warehouseId: Number(item.warehouseId),
      rules: item.rules
        .map((r) => ruleToApi(r, rulesDict))
        .filter((r): r is IMappingRule => r !== null),
    })),
  };
}
