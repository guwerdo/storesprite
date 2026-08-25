import { describe, expect, it } from "vitest";
import {
    createDataElements,
    createDescriptionElement,
    createImageElement,
    createImagesElement,
    createProductElement,
    createStockElements,
} from "./product-request-xml-builder.js";

describe("product request XML builder", () => {
    it("wraps a description in CDATA", () => {
        expect(createDescriptionElement("hello <b>world</b>")).toEqual({ Long: { "#cdata": "hello <b>world</b>" } });
    });

    it("throws when a stock is missing quantity", () => {
        expect(() => createStockElements([{ quantity: undefined as unknown as number }])).toThrow();
    });

    it("omits warehouseId for the main warehouse", () => {
        expect(createStockElements([{ warehouseId: 1, quantity: 5 }])).toEqual([
            { WarehouseId: undefined, IsActive: "yes", Qty: 5 },
        ]);
    });

    it("keeps an explicit warehouseId", () => {
        expect(createStockElements([{ warehouseId: 5726549, quantity: 22 }])).toEqual([
            { WarehouseId: 5726549, IsActive: "yes", Qty: 22 },
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
