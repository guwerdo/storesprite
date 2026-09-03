import { describe, expect, it } from "vitest";
import { stringifyError } from "../../src/utils/error-util.js";

describe("stringifyError", () => {
    it("returns the stack for an Error", () => {
        expect(stringifyError(new Error("boom"))).toContain("boom");
    });
    it("falls back to message when there is no stack", () => {
        const err = new Error("no stack");
        err.stack = undefined;
        expect(stringifyError(err)).toBe("no stack");
    });
    it("JSON-stringifies a plain object", () => {
        expect(stringifyError({ code: "E1" })).toBe('{"code":"E1"}');
    });
    it("handles a circular object via toString", () => {
        const c: Record<string, unknown> = {};
        c.self = c;
        expect(stringifyError(c)).toBe("[object Object]");
    });
    it("returns strings unchanged", () => {
        expect(stringifyError("raw")).toBe("raw");
    });
    it("JSON-stringifies other primitives", () => {
        expect(stringifyError(42)).toBe("42");
        expect(stringifyError(null)).toBe("null");
    });
});
