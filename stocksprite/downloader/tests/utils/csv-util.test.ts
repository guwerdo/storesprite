import { describe, it, expect } from "vitest";
import { CsvUtil } from "../../src/utils/csv-util.js";

describe("CsvUtil.splitCsvRow", () => {
  it("splits on the delimiter", () => {
    expect(CsvUtil.splitCsvRow("sku;title;price", ";")).toEqual(["sku", "title", "price"]);
  });

  it("keeps a delimiter inside a quoted cell", () => {
    expect(CsvUtil.splitCsvRow('SKU002;"Item;Two";20', ";")).toEqual(["SKU002", "Item;Two", "20"]);
  });

  it("unescapes doubled quotes", () => {
    expect(CsvUtil.splitCsvRow('a;"say ""hi""";b', ";")).toEqual(["a", 'say "hi"', "b"]);
  });

  it("preserves empty cells", () => {
    expect(CsvUtil.splitCsvRow("a;;c", ";")).toEqual(["a", "", "c"]);
  });

  it("supports a custom delimiter", () => {
    expect(CsvUtil.splitCsvRow('x,"y,z",w', ",")).toEqual(["x", "y,z", "w"]);
  });
});
