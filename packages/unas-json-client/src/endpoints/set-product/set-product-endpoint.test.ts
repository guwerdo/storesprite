import { describe, expect, it } from "vitest";
import { loadFixture, normalizeXml } from "../../../test/helpers/load-fixture.js";
import { FastXmlService } from "../../xml/fast-xml-service.js";
import { SetProductEndpoint } from "./set-product-endpoint.js";
import type { ISetProductRequest } from "./set-product.types.js";

describe("SetProductEndpoint", () => {
    const endpoint = new SetProductEndpoint(new FastXmlService());

    const modifyRequest: ISetProductRequest = {
        products: [
            {
                sku: "KEN5824600K",
                stocks: [{ quantity: 11 }, { warehouseId: 5726549, quantity: 22 }],
            },
        ],
    };

    it("builds the setProduct XML", () => {
        const xml = endpoint.buildRequest(modifyRequest);
        expect(normalizeXml(xml)).toBe(normalizeXml(loadFixture("requests", "setProduct-modify.xml")));
    });

    it("parses per-product statuses", () => {
        const products = endpoint.parseResponse(loadFixture("responses", "setProduct-response-ok.xml"));
        expect(products).toEqual([{ id: "1340633016", sku: "KEN5824600K", action: "modify", status: "ok" }]);
    });

    it("maps an error status", () => {
        const products = endpoint.parseResponse(loadFixture("responses", "setProduct-response-error.xml"));
        expect(products[0].status).toBe("error");
    });

    it("returns an empty array for no products", () => {
        expect(endpoint.parseResponse("<Products></Products>")).toEqual([]);
    });
});
