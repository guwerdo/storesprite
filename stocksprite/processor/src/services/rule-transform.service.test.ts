import { describe, expect, it } from "vitest";
import { RuleTransformService } from "./rule-transform.service.js";

const service = new RuleTransformService();

describe("RuleTransformService", () => {
    describe("transformSku", () => {
        it("returns a trimmed SKU when no rules apply", () => {
            expect(service.transformSku("  ABC-1  ")).toBe("ABC-1");
        });

        it("runs the rule pipeline on the cell value", () => {
            const result = service.transformSku("my sku", [
                { op: "replace-all", params: { from: " ", to: "_" } },
            ]);
            expect(result).toBe("my_sku");
        });

        it("does not apply rules to an empty/whitespace cell (passthrough to empty)", () => {
            expect(service.transformSku("", [{ op: "multiply", params: { value: 2 } }])).toBeUndefined();
            expect(service.transformSku("   ", [])).toBeUndefined();
        });

        it("returns undefined for null / non-string values", () => {
            expect(service.transformSku(null)).toBeUndefined();
            expect(service.transformSku(undefined)).toBeUndefined();
        });
    });

    describe("transformStockQuantity", () => {
        it("parses a numeric string", () => {
            expect(service.transformStockQuantity("12")).toBe(12);
            expect(service.transformStockQuantity(" 12 ")).toBe(12);
        });

        it("treats an empty or whitespace cell as 0 (clear the warehouse)", () => {
            expect(service.transformStockQuantity("")).toBe(0);
            expect(service.transformStockQuantity("   ")).toBe(0);
            expect(service.transformStockQuantity(null)).toBe(0);
            expect(service.transformStockQuantity(undefined)).toBe(0);
        });

        it("clamps negative quantities to 0", () => {
            expect(service.transformStockQuantity("-5")).toBe(0);
        });

        it("applies stock rules before coercion", () => {
            expect(
                service.transformStockQuantity("10", [{ op: "multiply", params: { value: 1000 } }])
            ).toBe(10000);
        });

        it("throws for a non-numeric, non-empty cell without a numeric rule", () => {
            expect(() => service.transformStockQuantity("abc")).toThrow();
        });
    });
});
