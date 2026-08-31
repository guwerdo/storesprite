export type MappingRuleParamType = "number" | "string";
export type MappingRuleGroup = "sku" | "stock" | "data";

export interface MappingRuleParamDefinition {
  name: string;
  type: MappingRuleParamType;
}

export interface MappingRuleDefinition {
  op: string;
  groups: MappingRuleGroup[];
  params: MappingRuleParamDefinition[];
}

/**
 * Static, language-neutral dictionary of the available mapping transform ops.
 * Each op declares the group(s) it belongs to (`sku` / `stock` / `data`) and the
 * params it requires. A single op may belong to multiple groups.
 *
 * The worker maps each op to a jsonlogic expression; the frontend fetches this
 * dictionary via `GET /client/stocksprite/mappings/rules`.
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
