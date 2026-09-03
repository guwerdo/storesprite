import { describe, it, expect } from "vitest";
import { EncodingUtil } from "../../src/utils/encoding-util.js";

describe("EncodingUtil.normalizeEncoding", () => {
  it("defaults to utf-8 when no encoding is given", () => {
    expect(EncodingUtil.normalizeEncoding(undefined)).toBe("utf-8");
    expect(EncodingUtil.normalizeEncoding("")).toBe("utf-8");
  });

  it("normalizes UTF-8 BOM spellings to plain utf-8", () => {
    expect(EncodingUtil.normalizeEncoding("UTF-8-BOM")).toBe("utf-8");
    expect(EncodingUtil.normalizeEncoding("utf8-bom")).toBe("utf-8");
    expect(EncodingUtil.normalizeEncoding("UTF-8 with BOM")).toBe("utf-8");
  });

  it("lowercases and trims any other encoding", () => {
    expect(EncodingUtil.normalizeEncoding(" Windows-1250 ")).toBe("windows-1250");
    expect(EncodingUtil.normalizeEncoding("ISO-8859-2")).toBe("iso-8859-2");
  });
});
