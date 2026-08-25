import { describe, expect, it } from "vitest";
import { FastXmlService } from "./fast-xml-service.js";

describe("FastXmlService", () => {
    const xml = new FastXmlService();

    it("builds a minified document with the XML prolog", () => {
        const result = xml.buildDocument({ Params: { ApiKey: "k", WebshopInfo: "true" } });
        expect(result.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(result).toContain("<Params><ApiKey>k</ApiKey><WebshopInfo>true</WebshopInfo></Params>");
    });

    it("parses a single repeating element into an array", () => {
        const parsed = xml.parse<{ Warehouses: { Warehouse: { Id: number }[] } }>(
            "<Warehouses><Warehouse><Id>1</Id></Warehouse></Warehouses>",
        );
        expect(Array.isArray(parsed.Warehouses.Warehouse)).toBe(true);
        expect(parsed.Warehouses.Warehouse[0].Id).toBe(1);
    });

    it("parses CDATA content", () => {
        const parsed = xml.parse<{ Long: string }>("<Long><![CDATA[a < b & c]]></Long>");
        expect(parsed.Long).toBe("a < b & c");
    });
});
