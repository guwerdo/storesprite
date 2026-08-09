import { describe, expect, it } from "vitest";

import { IDataDto, IStockDto } from "../../../dto/interfaces/index.js";
import { IImageElement } from "./interfaces/image-element.interface.js";
import { IImagesElement } from "./interfaces/images-element.interface.js";
import { IProductElement } from "./interfaces/product-element.interface.js";
import {
    createDataElement,
    createDescriptionElement,
    createImageElement,
    createImagesElement,
    createProductElement,
    createSetProductRequestXml,
    createStockElement,
} from "./set-product-request-builder.js";

describe("SetProductRequestBuilder", () => {
    describe("createSetProductRequestXml", () => {
        it("should build a valid XML string when given product elements", () => {
            // Arrange
            const productElements: IProductElement[] = [
                createProductElement(
                    "sku123",
                    createDescriptionElement("Test Description"),
                    createStockElement([{ warehouseId: 1, quantity: 10 } as IStockDto]),
                    createImagesElement("filename", "alt", 1, "v1", []),
                    createDataElement([{ id: 1, name: "name", value: "value" } as IDataDto]),
                ),
            ];

            // Act
            const result = createSetProductRequestXml(productElements);

            // Assert
            expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(result).toContain("<Products>");
            expect(result).toContain("<Product>");
        });
    });

    describe("createProductElement", () => {
        it("should create a valid product element when given all parameters", () => {
            // Arrange
            const sku = "sku123";
            const description = createDescriptionElement("Test Description");
            const stocks = createStockElement([{ warehouseId: 1, quantity: 10 } as IStockDto]);
            const images = createImagesElement("filename", "alt", 1, "v1", []);
            const datas = createDataElement([{ id: 1, name: "name", value: "value" } as IDataDto]);

            // Act
            const productElement: IProductElement = createProductElement(sku, description, stocks, images, datas);

            // Assert
            expect(productElement.Sku).toBe("sku123");
            expect(productElement.Description?.Long["#cdata"]).toBe("Test Description");
        });
    });

    describe("createStockElement", () => {
        it("should throw an error when stock data is invalid", () => {
            // Arrange
            const invalidStock = [{ warehouseId: null, quantity: null } as unknown as IStockDto];

            // Act & Assert
            expect(() => createStockElement(invalidStock)).toThrow("StockDto is missing quantity or warehouseId");
        });
    });

    describe("createDataElement", () => {
        it("should throw an error when data element is invalid", () => {
            // Arrange
            const invalidData = [{ id: null, name: "name", value: null } as unknown as IDataDto];

            // Act & Assert
            expect(() => createDataElement(invalidData)).toThrow("DataDto is missing value or id");
        });
    });

    describe("createImagesElement", () => {
        it("should create a valid images element when given parameters", () => {
            // Arrange
            const filename = "filename";
            const alt = "alt";
            const order = 1;
            const version = "v1";
            const images: IImageElement[] = [];

            // Act
            const imagesElement: IImagesElement = createImagesElement(filename, alt, order, version, images);

            // Assert
            expect(imagesElement.DefaultFilename["#cdata"]).toBe("filename");
            expect(imagesElement.DefaultAlt["#cdata"]).toBe("alt");
        });
    });

    describe("createImageElement", () => {
        it("should create a valid image element when given all parameters", () => {
            // Arrange
            const type = "base";
            const id = 1;
            const sefUrl = "sefUrl";
            const filename = "filename";
            const alt = "alt";
            const importUrl = "importUrl";

            // Act
            const imageElement: IImageElement = createImageElement(type, id, sefUrl, filename, alt, importUrl);

            // Assert
            expect(imageElement.Type).toBe("base");
            expect(imageElement.Id).toBe(1);
            expect(imageElement.SefUrl["#cdata"]).toBe("sefUrl");
        });
    });
});
