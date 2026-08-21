import type { Logger } from "log4js";
import { describe, expect, it, vi } from "vitest";

import { DataSourceMapper } from "./data-source-mapper.js";
import type { IDataSourceDataMapping, IDataSourceFieldMapping, IDataSourceRuleCollection, IDataSourceStockMapping } from "./interfaces/index.js";

describe("DataSourceMapper", () => {
    const setupLogger = (): Logger =>
        ({
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        }) as unknown as Logger;

    const setupRuleCollection = (rules: Record<string, unknown> = {}) => {
        const getMock = vi.fn((id: string) => {
            const rule = rules[id];
            if (!rule) {
                throw new Error(`Rule not found: ${id}`);
            }
            return rule;
        });

        const ruleCollection = { get: getMock } as unknown as IDataSourceRuleCollection;
        return { ruleCollection, getMock };
    };

    const setupMapper = (rules: Record<string, unknown> = {}) => {
        const logger = setupLogger();
        const { ruleCollection, getMock } = setupRuleCollection(rules);
        return {
            mapper: new DataSourceMapper(logger, ruleCollection),
            getMock,
        };
    };

    describe("mapField", () => {
        it("should map a field when using a mapping function", async () => {
            // Arrange
            const { mapper, getMock } = setupMapper({
                rule1: { var: "name" },
            });
            const mapping: IDataSourceFieldMapping = { fields: ["name"], ruleId: "rule1" };

            // Act
            const result = await mapper.mapField({ name: "SKU-1" }, mapping);

            // Assert
            expect(result).toBe("SKU-1");
            expect(getMock).toHaveBeenCalledWith("rule1");
        });

        it("should map a field when no mapping function is provided", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mapping: IDataSourceFieldMapping = { fields: ["name"] };

            // Act
            const result = await mapper.mapField({ name: "Value" }, mapping);

            // Assert
            expect(result).toBe("Value");
        });

        it("should return undefined when field value is empty", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mapping: IDataSourceFieldMapping = { fields: ["name"] };

            // Act
            const result = await mapper.mapField({ name: "" }, mapping);

            // Assert
            expect(result).toBeUndefined();
        });

        it("should throw when mapping has no fields", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mapping = { fields: [] } as IDataSourceFieldMapping;

            // Act
            const action = mapper.mapField({ name: "Value" }, mapping);

            // Assert
            await expect(action).rejects.toThrow("No fields defined for mapping");
        });

        it("should throw when mapping has multiple fields without a function", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mapping: IDataSourceFieldMapping = { fields: ["first", "second"] };

            // Act
            const action = mapper.mapField({ first: "A", second: "B" }, mapping);

            // Assert
            await expect(action).rejects.toThrow("No mapping function defined for multiple fields");
        });

        it("should throw when a mapping field is missing", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mapping: IDataSourceFieldMapping = { fields: ["missing"] };

            // Act
            const action = mapper.mapField({ name: "Value" }, mapping);

            // Assert
            await expect(action).rejects.toThrow("Mapping field not found in datasource: missing");
        });
    });

    describe("mapStocksField", () => {
        it("should map stock quantities and clamp negatives to zero when using a mapping function", async () => {
            // Arrange
            const { mapper } = setupMapper({
                qtyRule: { var: "qty" },
            });
            const mappings: IDataSourceStockMapping[] = [
                {
                    warehouseId: 1,
                    mapping: { fields: ["qty"], ruleId: "qtyRule" },
                },
            ];

            // Act
            const result = await mapper.mapStocksField({ qty: "-5" }, mappings);

            // Assert
            expect(result).toEqual([{ warehouseId: 1, quantity: 0 }]);
        });

        it("should map stock quantities and default to zero when no mapping function is provided", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mappings: IDataSourceStockMapping[] = [
                {
                    warehouseId: 2,
                    mapping: { fields: ["qty"] },
                },
            ];

            // Act
            const result = await mapper.mapStocksField({ qty: "" }, mappings);

            // Assert
            expect(result).toEqual([{ warehouseId: 2, quantity: 0 }]);
        });

        it("should throw when warehouseId is missing", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mappings = [
                {
                    warehouseId: undefined as unknown as number,
                    mapping: { fields: ["qty"] },
                },
            ] as IDataSourceStockMapping[];

            // Act
            const action = mapper.mapStocksField({ qty: "10" }, mappings);

            // Assert
            await expect(action).rejects.toThrow("Warehouse ID is not found in Unas webshop");
        });
    });

    describe("mapDatasField", () => {
        it("should map data entries when using a mapping function", async () => {
            // Arrange
            const { mapper } = setupMapper({
                dataRule: { var: "color" },
            });
            const mappings: IDataSourceDataMapping[] = [
                {
                    id: 1,
                    name: "Color",
                    mapping: { fields: ["color"], ruleId: "dataRule" },
                },
            ];

            // Act
            const result = await mapper.mapDatasField({ color: "Red" }, mappings);

            // Assert
            expect(result).toEqual([{ id: 1, value: "Red" }]);
        });

        it("should return empty string when mapped values are empty", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mappings: IDataSourceDataMapping[] = [
                {
                    id: 2,
                    name: "Empty",
                    mapping: { fields: ["empty"] },
                },
            ];

            // Act
            const result = await mapper.mapDatasField({ empty: "" }, mappings);

            // Assert
            expect(result).toEqual([{ id: 2, value: "" }]);
        });

        it("should throw when data id is missing", async () => {
            // Arrange
            const { mapper } = setupMapper();
            const mappings = [
                {
                    id: 0,
                    name: "Missing",
                    mapping: { fields: ["value"] },
                },
            ] as IDataSourceDataMapping[];

            // Act
            const action = mapper.mapDatasField({ value: "Value" }, mappings);

            // Assert
            await expect(action).rejects.toThrow("Data id is not found");
        });
    });
});
