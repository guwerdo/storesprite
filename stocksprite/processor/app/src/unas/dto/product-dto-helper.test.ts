import { describe, expect, it } from "vitest";

import { IProductDto } from "./interfaces/index.js";
import { comparePlainProductDto, mergePlainProductDto, normalize } from "./product-dto-helper.js";

describe("comparePlainProductDto", () => {
    it("should return an empty array when products are identical", () => {
        // Arrange
        const productA: IProductDto = {
            sku: "123",
            description: "Product A",
            stocks: [{ warehouseId: 1, quantity: 10 }],
            images: undefined,
            datas: [],
        };

        const productB: IProductDto = {
            sku: "123",
            description: "Product A",
            stocks: [{ warehouseId: 1, quantity: 10 }],
            images: undefined,
            datas: [],
        };

        // Act
        const result = comparePlainProductDto(productA, productB);

        // Assert
        expect(result).toEqual([]);
    });

    it("should return differences when products have different values", () => {
        // Arrange
        const productA: IProductDto = {
            sku: "123",
            description: "Product A",
            stocks: [{ warehouseId: 1, quantity: 10 }],
            images: undefined,
            datas: [
                { id: 1, value: "value1" },
                { id: 2, value: "value2" },
            ],
        };

        const productB: IProductDto = {
            sku: "123",
            description: "Product B",
            stocks: [{ warehouseId: 1, quantity: 20 }],
            images: undefined,
            datas: [
                { id: 1, value: "value1" },
                { id: 2, value: "diff" },
            ],
        };

        // Act
        const result = comparePlainProductDto(productA, productB);

        // Assert
        expect(result).toEqual([
            { op: "replace", path: ["description"], value: "Product B" },
            { op: "replace", path: ["stocks", 0, "quantity"], value: 20 },
            { op: "replace", path: ["datas", 1, "value"], value: "diff" },
        ]);
    });

    it("should throw an error when non-plain objects are passed", () => {
        // Arrange
        const productA = new Map();
        const productB = new Map();

        // Act & Assert
        expect(() => comparePlainProductDto(productA as unknown as IProductDto, productB as unknown as IProductDto)).toThrow(
            "Both arguments must be plain JavaScript objects.",
        );
    });
});

describe("mergePlainProductDto", () => {
    it("should merge products with no conflicts", () => {
        // Arrange
        const source: IProductDto = {
            sku: "123",
            description: "Updated Product A",
            stocks: [{ warehouseId: 2, quantity: 5 }],
            images: undefined,
            datas: [{ id: 1, value: "value1" }],
        };

        const target: IProductDto = {
            sku: "123",
            description: "Product A",
            stocks: [{ warehouseId: 1, quantity: 10 }],
            images: undefined,
            datas: [],
        };

        // Act
        const result = mergePlainProductDto(target, source);

        // Assert
        expect(result).toEqual({
            sku: "123",
            description: "Updated Product A",
            stocks: [
                { warehouseId: 1, quantity: 10 },
                { warehouseId: 2, quantity: 5 },
            ],
            images: undefined,
            datas: [{ id: 1, value: "value1" }],
        });
    });

    it("should overwrite conflicting fields when merging", () => {
        // Arrange
        const source: IProductDto = {
            sku: "123",
            description: "Updated Product A",
            stocks: [{ warehouseId: 1, quantity: 20 }],
            images: undefined,
            datas: [{ id: 1, value: "updatedValue" }],
        };

        const target: IProductDto = {
            sku: "123",
            description: "Product A",
            stocks: [{ warehouseId: 1, quantity: 10 }],
            images: undefined,
            datas: [{ id: 1, value: "value1" }],
        };

        // Act
        const result = mergePlainProductDto(target, source);

        // Assert
        expect(result).toEqual({
            sku: "123",
            description: "Updated Product A",
            stocks: [{ warehouseId: 1, quantity: 20 }],
            images: undefined,
            datas: [{ id: 1, value: "updatedValue" }],
        });
    });

    it("should throw an error when non-plain objects are passed", () => {
        // Arrange
        const source = new Map();
        const target = new Map();

        // Act & Assert
        expect(() => mergePlainProductDto(target as unknown as IProductDto, source as unknown as IProductDto)).toThrow(
            "Both arguments must be plain JavaScript objects.",
        );
    });
});

describe("normalize", () => {
    it("should sort array elements by id", () => {
        // Arrange
        const input = [
            { id: 2, name: "B" },
            { id: 1, name: "A" },
        ];

        // Act
        const result = normalize(input);

        // Assert
        expect(result).toEqual([
            { id: 1, name: "A" },
            { id: 2, name: "B" },
        ]);
    });

    it("should normalize nested objects and arrays", () => {
        // Arrange
        const input = {
            b: [
                { id: 2, value: "B" },
                { id: 1, value: "A" },
            ],
            a: "test",
        };

        // Act
        const result = normalize(input);

        // Assert
        expect(result).toEqual({
            a: "test",
            b: [
                { id: 1, value: "A" },
                { id: 2, value: "B" },
            ],
        });
    });

    it("should return primitive values unchanged", () => {
        // Arrange, Act & Assert
        expect(normalize(42)).toBe(42);
        expect(normalize("test")).toBe("test");
        expect(normalize(null)).toBe(null);
    });

    it("should throw an error when circular references are detected", () => {
        // Arrange
        const obj: Record<string, unknown> = {};
        obj.self = obj;

        // Act & Assert
        expect(() => normalize(obj)).toThrow();
    });
});
