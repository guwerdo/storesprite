import fs from "fs";
import jsonLogic from "json-logic-js";
import { Logger } from "log4js";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DataSourceRuleCollection } from "./data-source-rule-collection.js";
import type { IDataSourceRuleProvider } from "./interfaces/data-source-rule-provider.interface.js";
import { customLogicOperators } from "./json-logic-custom-operator.js";

describe("data-source-rule", () => {
    const mockLogger = {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    } as unknown as Logger;

    const mockDataSourceRuleProvider: IDataSourceRuleProvider = {
        getJsonRules: vi.fn().mockImplementation(() => {
            const rulesFilePath = "data-source/data-source-rules.json";
            let rulesJSON: string;
            try {
                rulesJSON = fs.readFileSync(rulesFilePath, "utf-8");
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to load rules file '${rulesFilePath}': ${message}`);
            }

            return JSON.parse(rulesJSON) as unknown;
        }),
    };

    const ruleCollection = new DataSourceRuleCollection(mockLogger, mockDataSourceRuleProvider);

    beforeAll(() => {
        customLogicOperators();
    });

    describe("magictools-replace-spaces-in-sku-with-underscores rule", () => {
        const rule = ruleCollection.get("magictools-replace-spaces-in-sku-with-underscores");

        it("should replace spaces with underscores in the Cikkszám field", () => {
            // Arrange
            const data = { Cikkszám: "ABC 123" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("ABC_123");
        });

        it("should replace multiple spaces with underscores in the Cikkszám field", () => {
            // Arrange
            const data = { Cikkszám: "ABC 123 456" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("ABC_123_456");
        });

        it("should replace multiple spaces next to each other with underscores in the Cikkszám field", () => {
            // Arrange
            const data = { Cikkszám: "ABC  123   456" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("ABC__123___456");
        });
    });

    describe("magictools-expected-incoming-quantity rule", () => {
        const rule = ruleCollection.get("magictools-expected-incoming-quantity");

        it("should return 0 when no numeric values are present", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "", "Várható érkezés dátum": "" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return 0 when expected incoming quantity is defined but expected arrival date is missing", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "32", "Várható érkezés dátum": "" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return 0 when expected incoming quantity is zero and expected arrival date is in the past", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "0", "Várható érkezés dátum": "2024.06.01" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return expected incoming quantity when expected arrival date is in the future", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "56", "Várható érkezés dátum": "2040.06.01" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe("56");
        });

        it("should return 0 when expected incoming quantity exists but expected arrival date is in the past", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "5", "Várható érkezés dátum": "2024.06.01" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });
    });

    describe("magictools-expected-incoming-date rule", () => {
        const rule = ruleCollection.get("magictools-expected-incoming-date");

        it("should return empty string when no numeric values are present", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "", "Várható érkezés dátum": "2040.06.01" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("");
        });

        it("should return empty string when expected incoming quantity is invalid", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "N/A", "Várható érkezés dátum": "2040.06.01" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("");
        });

        it("should return empty string when expected arrival date is missing", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "12", "Várható érkezés dátum": "" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("");
        });

        it("should return empty string when expected arrival date is in the past", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "12", "Várható érkezés dátum": "2024.06.01" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("");
        });

        it("should return the expected arrival date when it is in the future", () => {
            // Arrange
            const data = { "Várható érkezés mennyiség": "12", "Várható érkezés dátum": "2040.06.01" };

            // Act
            const result = jsonLogic.apply(rule, data) as string;

            // Assert
            expect(result).toBe("2040.06.01");
        });
    });

    describe("depiend-stock-count-from-stock-interval", () => {
        const rule = ruleCollection.get("depiend-stock-count-from-stock-interval");
        it("should return 0 when no numeric values are present", () => {
            // Arrange
            const data = { "Gyártói készlet": "N/A" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return 0 when all interval numbers are zero", () => {
            // Arrange
            const data = { "Gyártói készlet": "0 - 0 db" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should returns 0 when single number is zero with unit", () => {
            // Arrange
            const data = { "Gyártói készlet": "0 db" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should returns 0 when single number is zero without unit", () => {
            // Arrange
            const data = { "Gyártói készlet": "0" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return the median of the interval", () => {
            // Arrange
            const data = { "Gyártói készlet": "0 - 5 db" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(3);
        });

        it("should return 4 for single positive stock values with unit", () => {
            // Arrange
            const data = { "Gyártói készlet": "4 db" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(4);
        });

        it("should return 4 for single positive stock values without unit", () => {
            // Arrange
            const data = { "Gyártói készlet": "4" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(4);
        });

        it("should return 372 when stock interval is greater than zero", () => {
            // Arrange
            const data = { "Gyártói készlet": "288 - 455 db" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(372);
        });
    });

    describe("stanley-stock-multiplier", () => {
        const rule = ruleCollection.get("stanley-stock-multiplier");
        it("should return 1000 when numeric value is 1", () => {
            // Arrange
            const data = { stock: 1 };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(1000);
        });

        it("should return 4000 when numeric value is 4", () => {
            // Arrange
            const data = { stock: 4 };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(4000);
        });

        it("should return 4000 when numeric value is a numeric string", () => {
            // Arrange
            const data = { stock: "4" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(4000);
        });

        it("should return 0 when numeric value is 0", () => {
            // Arrange
            const data = { stock: 0 };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return 0 when numeric value is empty", () => {
            // Arrange
            const data = { stock: "" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return 0 when numeric value is null", () => {
            // Arrange
            const data = { stock: null };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });

        it("should return 0 when stock value is not numeric", () => {
            // Arrange
            const data = { stock: "N/A" };

            // Act
            const result = jsonLogic.apply(rule, data) as number;

            // Assert
            expect(result).toBe(0);
        });
    });
});
