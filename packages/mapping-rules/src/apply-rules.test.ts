import { describe, expect, it } from "vitest";
import { MAPPING_RULES, applyRule, applyRules, type MappingRule } from "./index.js";

const rule = (op: string, params: Record<string, string | number> = {}): MappingRule => ({ op, params });

describe("applyRule", () => {
  describe("numeric ops (happy path)", () => {
    it("multiplies", () => {
      expect(applyRule(4, rule("multiply", { value: 3 }))).toBe(12);
    });

    it("divides", () => {
      expect(applyRule(9, rule("divide", { value: 3 }))).toBe(3);
    });

    it("adds", () => {
      expect(applyRule(4, rule("add", { value: 5 }))).toBe(9);
    });

    it("subtracts", () => {
      expect(applyRule(10, rule("subtract", { value: 4 }))).toBe(6);
    });

    it("rounds to the requested decimals", () => {
      expect(applyRule(3.14159, rule("round", { decimals: 2 }))).toBe(3.14);
    });

    it("rounds to an integer when decimals is omitted", () => {
      expect(applyRule(3.6, rule("round"))).toBe(4);
    });

    it("returns the absolute value", () => {
      expect(applyRule(-7, rule("absolute"))).toBe(7);
    });

    it("averages an exact interval into an integer", () => {
      expect(applyRule("34-66", rule("average", { separator: "-" }))).toBe(50);
    });

    it("averages a half-integer interval by rounding to the nearest int", () => {
      expect(applyRule("33-66", rule("average", { separator: "-" }))).toBe(50);
    });

    it("replaces all occurrences", () => {
      expect(applyRule("part no part", rule("replace-all", { from: " ", to: "_" }))).toBe("part_no_part");
    });
  });

  describe("edge cases", () => {
    it("averages an empty / non-numeric value to 0", () => {
      expect(applyRule("", rule("average", { separator: "-" }))).toBe(0);
      expect(applyRule("abc", rule("average", { separator: "-" }))).toBe(0);
    });

    it("multiply with an empty cell resolves to 0", () => {
      expect(applyRule("", rule("multiply", { value: 1000 }))).toBe(0);
    });

    it("numeric ops on a non-numeric string coerce to NaN rather than throwing", () => {
      expect(Number.isNaN(applyRule("abc", rule("multiply", { value: 2 })))).toBe(true);
    });

    it("divide by omitted value falls back to 1 (no division by zero)", () => {
      expect(applyRule(10, rule("divide"))).toBe(10);
    });

    it("average of a single-part string returns that number", () => {
      expect(applyRule("40", rule("average", { separator: "-" }))).toBe(40);
    });

    it("replace-all with an empty `to` deletes the match", () => {
      expect(applyRule("a-b", rule("replace-all", { from: "-", to: "" }))).toBe("ab");
    });

    it("negativeToZero-style clamp is NOT done by absolute on multiply output", () => {
      // absolute is a separate op; a negative input should stay positive only when requested
      expect(applyRule(-4, rule("absolute"))).toBe(4);
    });

    it("round with negative decimals is handled by the factor math", () => {
      // 1234 rounded to -2 decimals -> 1200
      expect(applyRule(1234, rule("round", { decimals: -2 }))).toBe(1200);
    });
  });

  describe("unknown ops", () => {
    it("passes the value through unchanged", () => {
      expect(applyRule(42, rule("not-a-real-op"))).toBe(42);
      expect(applyRule("x", rule("not-a-real-op"))).toBe("x");
    });
  });
});

describe("applyRules (ordered pipeline)", () => {
  it("applies rules left to right, feeding each result into the next", () => {
    const rules = [
      rule("multiply", { value: 3 }),
      rule("subtract", { value: 1 }),
    ];
    expect(applyRules(4, rules)).toBe(11);
  });

  it("accepts string inputs and coerces through numeric ops", () => {
    const rules = [rule("multiply", { value: 2 })];
    expect(applyRules("5", rules)).toBe(10);
  });

  it("returns the input unchanged for an empty pipeline", () => {
    expect(applyRules("34-66", [])).toBe("34-66");
  });

  it("chains a sku transform end to end", () => {
    const rules = [
      rule("replace-all", { from: " ", to: "_" }),
      rule("replace-all", { from: "/", to: "-" }),
    ];
    expect(applyRules("part a/b", rules)).toBe("part_a-b");
  });
});

describe("MAPPING_RULES dictionary", () => {
  it("contains exactly the 8 supported ops", () => {
    const ops = MAPPING_RULES.map((r) => r.op).sort();
    expect(ops).toEqual(["absolute", "add", "average", "divide", "multiply", "replace-all", "round", "subtract"]);
  });

  it("declares replace-all for the sku group", () => {
    expect(MAPPING_RULES.find((r) => r.op === "replace-all")?.groups).toContain("sku");
  });
});
