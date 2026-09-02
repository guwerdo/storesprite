/**
 * @storesprite/mapping-rules — the single, shared rule engine for StoreSprite.
 *
 * A rule is a plain `{ op, params }` value applied left-to-right over a cell's
 * current value. There is intentionally no rule engine dependency (jsonlogic is
 * deferred with the multi-field conditional rules): the 8 supported ops are a
 * plain `switch`. Backend, processor and frontend all import from this package
 * so a rule behaves identically everywhere it is evaluated.
 */

export type MappingRuleGroup = "sku" | "stock" | "data";
export type MappingRuleParamType = "number" | "string";

export interface MappingRule {
  op: string;
  params: Record<string, string | number>;
}

export interface MappingRuleParamDefinition {
  name: string;
  type: MappingRuleParamType;
}

export interface MappingRuleDefinition {
  op: string;
  groups: MappingRuleGroup[];
  params: MappingRuleParamDefinition[];
}

export interface StockMappingItem {
  /**
   * @minLength 1
   */
  column: string;
  /**
   * @minimum 1
   */
  warehouseId: number;
  rules?: MappingRule[];
}

/**
 * Static, language-neutral dictionary of the available mapping transform ops.
 * Each op declares the group(s) it belongs to (`sku` / `stock` / `data`) and
 * the params it requires. A single op may belong to multiple groups.
 */
export const MAPPING_RULES: MappingRuleDefinition[] = [
  { op: "multiply",    groups: ["stock"],       params: [{ name: "value",    type: "number" }] },
  { op: "divide",      groups: ["stock"],       params: [{ name: "value",    type: "number" }] },
  { op: "add",         groups: ["stock"],       params: [{ name: "value",    type: "number" }] },
  { op: "subtract",    groups: ["stock"],       params: [{ name: "value",    type: "number" }] },
  { op: "round",       groups: ["stock"],       params: [{ name: "decimals", type: "number" }] },
  { op: "absolute",    groups: ["stock"],       params: [] },
  { op: "average",     groups: ["stock"],       params: [{ name: "separator", type: "string" }] },
  { op: "replace-all", groups: ["sku", "stock"], params: [{ name: "from", type: "string" }, { name: "to", type: "string" }] },
];

/** Applies a single rule to a value. Unknown ops return the value unchanged. */
export function applyRule(value: string | number, rule: MappingRule): string | number {
  const params = rule.params ?? {};
  switch (rule.op) {
    case "multiply": return Number(value) * Number(params.value ?? 0);
    case "divide":   return Number(value) / Number(params.value ?? 1);
    case "add":      return Number(value) + Number(params.value ?? 0);
    case "subtract": return Number(value) - Number(params.value ?? 0);
    case "round": {
      const decimals = Number(params.decimals ?? 0);
      const factor = Math.pow(10, decimals);
      return Math.round(Number(value) * factor) / factor;
    }
    case "absolute": return Math.abs(Number(value));
    case "average": {
      const separator = String(params.separator ?? "-");
      const nums = String(value).split(separator)
        .map((p) => Number(p.replace(/[^0-9.-]/g, "")))
        .filter((n) => !Number.isNaN(n));
      if (nums.length === 0) return 0;
      return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
    }
    case "replace-all": {
      const from = String(params.from ?? "");
      const to = String(params.to ?? "");
      return String(value).split(from).join(to);
    }
    default: return value;
  }
}

/** Folds `applyRule` over a rule pipeline in array order. */
export function applyRules(value: string | number, rules: MappingRule[]): string | number {
  let current = value;
  for (const rule of rules) current = applyRule(current, rule);
  return current;
}
