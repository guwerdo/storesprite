import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import type { IDataConverter } from "../../src/types/data-converter.interface.js";
import { ConverterFactory } from "../../src/services/converter-factory.js";

describe("ConverterFactory", () => {
  const csvConverter = { convert: vi.fn() } as unknown as IDataConverter;
  const xmlConverter = { convert: vi.fn() } as unknown as IDataConverter;
  const factory = new ConverterFactory(csvConverter, xmlConverter);

  it("returns the CSV converter for CSV (case-insensitive)", () => {
    expect(factory.getConverter("CSV")).toBe(csvConverter);
    expect(factory.getConverter("csv")).toBe(csvConverter);
  });

  it("returns the XML converter for XML", () => {
    expect(factory.getConverter("XML")).toBe(xmlConverter);
  });

  it("throws for an unsupported data format, preserving the original casing", () => {
    expect(() => factory.getConverter("JSON")).toThrow("Unsupported data format: 'JSON'");
    expect(() => factory.getConverter("json")).toThrow("Unsupported data format: 'json'");
  });
});
