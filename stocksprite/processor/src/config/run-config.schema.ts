/**
 * Ajv draft-07 schema for the `GET /api/internal/stocksprite/mappings/:id/run-config`
 * response. Keeping it as a typed module (instead of a raw .json import) means the
 * compiled `dist` needs no JSON-copy step and vitest/esbuild/tsc all agree on it.
 */
export const runConfigSchema = {
    type: "object",
    required: ["mapping", "unasConfig", "warehouses"],
    properties: {
        mapping: {
            type: "object",
            required: ["id", "connectionId", "skuField", "stockMappings"],
            properties: {
                id: { type: "string" },
                connectionId: { type: "string" },
                skuField: { type: "string" },
                skuRules: { type: "array", items: { $ref: "#/definitions/mappingRule" } },
                stockMappings: { type: "array", items: { $ref: "#/definitions/stockMappingItem" } },
            },
        },
        unasConfig: {
            type: "object",
            required: ["baseUrl", "apiKey"],
            properties: {
                baseUrl: { type: "string", minLength: 1 },
                apiKey: { type: "string", minLength: 1 },
            },
        },
        warehouses: {
            type: "array",
            items: {
                type: "object",
                required: ["id", "name"],
                properties: {
                    id: { type: "integer" },
                    name: { type: "string" },
                    publicName: { type: "string" },
                },
            },
        },
    },
    definitions: {
        mappingRule: {
            type: "object",
            required: ["op"],
            properties: {
                op: { type: "string" },
                params: { type: "object", additionalProperties: { type: ["string", "number"] } },
            },
        },
        stockMappingItem: {
            type: "object",
            required: ["column", "warehouseId"],
            properties: {
                column: { type: "string" },
                warehouseId: { type: "integer" },
                rules: { type: "array", items: { $ref: "#/definitions/mappingRule" } },
            },
        },
    },
} as const;
