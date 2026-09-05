import { injectable } from "inversify";
import { applyRules } from "@storesprite/mapping-rules";
import type { MappingRule } from "@storesprite/mapping-rules";
import { getNumberValue, getStringValue, negativeToZero, normalizeSku } from "../utils/mapping-util.js";
import { recordConvertedSku, recordTruncatedSku } from "../types/connection.interface.js";
import type { SkuNormalizations } from "../types/connection.interface.js";

/**
 * Coerces raw supplier CSV cells into the SKU string / integer quantity the
 * sync expects, running each cell through its `{op, params}` rules first.
 * Mirrors the legacy worker's mapping semantics (see utils/mapping.util.ts).
 */
@injectable()
export class RuleTransformService {
    /**
     * SKU: rule pipeline → non-empty string, whitespace-trimmed and normalized to
     * UNAS SKU format, else undefined (skip row). When `normalizations` is given,
     * each conversion/truncation applied is recorded on it (for the run history).
     */
    public transformSku(
        value: unknown,
        rules: MappingRule[] = [],
        normalizations?: SkuNormalizations
    ): string | undefined {
        const transformed =
            rules.length > 0 && (typeof value === "string" || typeof value === "number") ? applyRules(value, rules) : value;
        const raw = getStringValue(transformed);
        if (raw === undefined) {
            return undefined;
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
            return undefined;
        }
        const result = normalizeSku(trimmed);
        if (normalizations) {
            if (result.converted) {
                recordConvertedSku(normalizations, trimmed, result.sku);
            }
            if (result.truncated) {
                recordTruncatedSku(normalizations, trimmed);
            }
        }
        return result.sku;
    }

    /** Quantity: an empty/whitespace cell means "clear", any other cell is rule-piped and clamped to ≥ 0. */
    public transformStockQuantity(value: unknown, rules: MappingRule[] = []): number {
        const trimmed =
            typeof value === "number" ? String(value).trim() : typeof value === "string" ? value.trim() : "";
        if (trimmed.length === 0) {
            return 0;
        }
        const transformed = rules.length > 0 ? applyRules(trimmed, rules) : trimmed;
        return negativeToZero(getNumberValue(transformed) ?? 0);
    }
}
