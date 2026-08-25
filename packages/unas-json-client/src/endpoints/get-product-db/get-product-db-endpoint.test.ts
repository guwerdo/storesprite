import { describe, expect, it } from "vitest";
import { loadFixture, normalizeXml } from "../../../test/helpers/load-fixture.js";
import { FastXmlService } from "../../xml/fast-xml-service.js";
import { GetProductDbEndpoint } from "./get-product-db-endpoint.js";

describe("GetProductDbEndpoint", () => {
    const endpoint = new GetProductDbEndpoint(new FastXmlService());

    it("builds the getProductDB XML with defaults", () => {
        const xml = endpoint.buildRequest({});
        expect(normalizeXml(xml)).toBe(normalizeXml(loadFixture("requests", "getProductDB.xml")));
    });

    it("maps false flags to 0", () => {
        const xml = endpoint.buildRequest({ format: "json", getStock: false });
        const normalized = normalizeXml(xml);
        expect(normalized).toContain("<Format>json</Format>");
        expect(normalized).toContain("<GetStock>0</GetStock>");
    });

    it("parses the CSV URL", () => {
        const url = endpoint.parseResponse(loadFixture("responses", "getProductDB-response.xml"));
        expect(url).toBe("http://wiremock:8080/shop/temp/products.csv");
    });

    it("throws when the URL is missing", () => {
        expect(() => endpoint.parseResponse("<getProductDB></getProductDB>")).toThrow();
    });
});
