import { describe, it, expect } from "vitest";
import { ErrorUtil } from "../../src/utils/error-util.js";

describe("ErrorUtil.stringifyError", () => {
  it("returns the stack for an Error", () => {
    expect(ErrorUtil.stringifyError(new Error("boom"))).toContain("boom");
  });

  it("falls back to message when an Error has no stack", () => {
    const err = new Error("no stack");
    err.stack = undefined;
    expect(ErrorUtil.stringifyError(err)).toBe("no stack");
  });

  it("JSON-stringifies a plain object", () => {
    expect(ErrorUtil.stringifyError({ code: "E1" })).toBe('{"code":"E1"}');
  });

  it("falls back to toString for a circular object", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(ErrorUtil.stringifyError(circular)).toBe("[object Object]");
  });

  it("returns a string as-is", () => {
    expect(ErrorUtil.stringifyError("plain")).toBe("plain");
  });

  it("JSON-stringifies non-object, non-error primitives", () => {
    expect(ErrorUtil.stringifyError(42)).toBe("42");
    expect(ErrorUtil.stringifyError(true)).toBe("true");
    expect(ErrorUtil.stringifyError(null)).toBe("null");
  });
});
