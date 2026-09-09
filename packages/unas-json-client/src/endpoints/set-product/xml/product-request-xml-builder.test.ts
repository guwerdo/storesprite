import { describe, expect, it } from "vitest";
import {
    createCategoryElements,
    createDataElements,
    createDescriptionElement,
    createImageElement,
    createImagesElement,
    createPricesElement,
    createProductElement,
    createStockElements,
} from "./product-request-xml-builder.js";

describe("product request XML builder", () => {
    it("wraps a description in CDATA", () => {
        expect(createDescriptionElement("hello <b>world</b>")).toEqual({ Long: { "#cdata": "hello <b>world</b>" } });
    });

    it("wraps a product name in CDATA", () => {
        const elem = createProductElement({ sku: "SKU1", name: "My Product" });
        expect(elem.Name).toEqual({ "#cdata": "My Product" });
    });

    it("creates category elements", () => {
        expect(createCategoryElements([{ id: 729110, type: "base" }])).toEqual([{ Type: "base", Id: 729110 }]);
    });

    it("creates prices element with Vat and Price array", () => {
        const prices = createPricesElement({
            vat: "27%",
            prices: [{ type: "normal", net: 100, gross: 200, actual: 1 }],
        });
        expect(prices).toEqual({
            Vat: "27%",
            Price: [{ Type: "normal", Net: 100, Gross: 200, Actual: 1 }],
        });
    });

    it("throws when a stock is missing quantity", () => {
        expect(() => createStockElements([{ quantity: undefined as unknown as number }])).toThrow();
    });

    it("omits warehouseId for the main warehouse numeric 1 or string '1'", () => {
        expect(createStockElements([{ warehouseId: 1, quantity: 5 }])).toEqual([
            { WarehouseId: undefined, IsActive: "yes", Qty: 5 },
        ]);
        expect(createStockElements([{ warehouseId: "1", quantity: 5 }])).toEqual([
            { WarehouseId: undefined, IsActive: "yes", Qty: 5 },
        ]);
    });

    it("keeps an explicit warehouseId (numeric or string)", () => {
        expect(createStockElements([{ warehouseId: 5726549, quantity: 22 }])).toEqual([
            { WarehouseId: 5726549, IsActive: "yes", Qty: 22 },
        ]);
        expect(createStockElements([{ warehouseId: "cromwell-stock-hu", quantity: 10 }])).toEqual([
            { WarehouseId: "cromwell-stock-hu", IsActive: "yes", Qty: 10 },
        ]);
    });

    it("throws when a data element is missing value", () => {
        expect(() => createDataElements([{ id: 1, value: undefined as unknown as string }])).toThrow();
    });

    it("wraps a data value in CDATA", () => {
        expect(createDataElements([{ id: 1, value: "v" }])).toEqual([{ Id: 1, Value: { "#cdata": "v" } }]);
    });

    it("builds an image element with CDATA", () => {
        expect(createImageElement({ type: "base", id: 1, sefUrl: "u", filename: "f", alt: "a", importUrl: "i" })).toEqual({
            Type: "base",
            Id: 1,
            SefUrl: { "#cdata": "u" },
            Filename: { "#cdata": "f" },
            Alt: { "#cdata": "a" },
            Import: { Url: "i" },
        });
    });

    it("builds an images element", () => {
        const images = createImagesElement({ defaultFilename: "df", defaultAlt: "da", og: 1, version: "8", images: [] });
        expect(images.Version).toBe("8");
        expect(images.DefaultFilename).toEqual({ "#cdata": "df" });
    });

    it("defaults the action to modify", () => {
        expect(createProductElement({ sku: "S" }).Action).toBe("modify");
    });
});
