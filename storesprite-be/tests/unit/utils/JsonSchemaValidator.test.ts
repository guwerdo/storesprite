import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { JsonSchemaValidator, SchemaValidationError } from "../../../src/utils/JsonSchemaValidator.js";

const validator = new JsonSchemaValidator();

const valid = {
  converted: { count: 2, examples: [{ before: "123.ASD", after: "123_ASD" }] },
  truncated: { count: 0, examples: [] },
};

describe("JsonSchemaValidator", () => {
  describe("validateSkuNormalizations", () => {
    it("accepts a valid populated object", () => {
      expect(validator.validateSkuNormalizations(valid)).toEqual(valid);
    });

    it("accepts the empty shape", () => {
      const empty = { converted: { count: 0, examples: [] }, truncated: { count: 0, examples: [] } };
      expect(validator.validateSkuNormalizations(empty)).toEqual(empty);
    });

    it("rejects a missing converted.count", () => {
      const bad = { converted: { examples: [] }, truncated: { count: 0, examples: [] } };
      expect(() => validator.validateSkuNormalizations(bad)).toThrow(SchemaValidationError);
    });

    it("rejects a non-integer count", () => {
      const bad = { converted: { count: "x", examples: [] }, truncated: { count: 0, examples: [] } };
      expect(() => validator.validateSkuNormalizations(bad)).toThrow(SchemaValidationError);
    });

    it("rejects a negative count", () => {
      const bad = { converted: { count: -1, examples: [] }, truncated: { count: 0, examples: [] } };
      expect(() => validator.validateSkuNormalizations(bad)).toThrow(SchemaValidationError);
    });

    it("rejects an example that is not a before/after object", () => {
      const bad = { converted: { count: 1, examples: ["123.ASD"] }, truncated: { count: 0, examples: [] } };
      expect(() => validator.validateSkuNormalizations(bad)).toThrow(SchemaValidationError);
    });

    it("rejects an unknown top-level property (additionalProperties false)", () => {
      const bad = { ...valid, extra: true };
      expect(() => validator.validateSkuNormalizations(bad)).toThrow(SchemaValidationError);
    });

    it("rejects more than 5 examples", () => {
      const examples = Array.from({ length: 6 }, (_, i) => ({ before: `a.${i}`, after: `a_${i}` }));
      const bad = { converted: { count: 6, examples }, truncated: { count: 0, examples: [] } };
      expect(() => validator.validateSkuNormalizations(bad)).toThrow(SchemaValidationError);
    });

    it("rejects a non-object payload", () => {
      expect(() => validator.validateSkuNormalizations(null)).toThrow(SchemaValidationError);
      expect(() => validator.validateSkuNormalizations("nope")).toThrow(SchemaValidationError);
    });
  });
});
