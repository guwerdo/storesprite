import type { Logger } from "log4js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataSourceRuleCollection } from "./data-source-rule-collection.js";
import { DataSourceRuleProvider } from "./data-source-rule-provider.js";

describe("DataSourceRuleCollection", () => {
    let dataSourceRuleCollection: DataSourceRuleCollection;
    let mockDataSourceRuleProvider: DataSourceRuleProvider;
    let mockLogger: Logger;

    beforeEach(() => {
        mockLogger = {
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        } as unknown as Logger;

        mockDataSourceRuleProvider = {
            getJsonRules: vi.fn().mockReturnValue([
                { id: "rule1", rule: { test: "value1" } },
                { id: "rule2", rule: { test: "value2" } },
                { id: "rule3", rule: { test: "value3" } },
            ]),
        };

        dataSourceRuleCollection = new DataSourceRuleCollection(mockLogger, mockDataSourceRuleProvider);
    });

    describe("rule", () => {
        it("should return rule when id exists", () => {
            // Arrange
            const ruleId = "rule2";

            // Act
            const result = dataSourceRuleCollection.get(ruleId);

            // Assert
            expect(result).toEqual({ test: "value2" });
        });

        it("should throw error when rule is not found", () => {
            // Arrange
            const nonExistentId = "nonexistent";

            // Act & Assert
            expect(() => dataSourceRuleCollection.get(nonExistentId)).toThrow("Rule not found: nonexistent");
        });

        it("should return first rule when multiple rules exist", () => {
            // Arrange
            const firstRuleId = "rule1";

            // Act
            const result = dataSourceRuleCollection.get(firstRuleId);

            // Assert
            expect(result).toEqual({ test: "value1" });
        });

        it("should throw error when rules array is empty", () => {
            // Arrange
            mockDataSourceRuleProvider = {
                getJsonRules: vi.fn().mockReturnValue([]),
            };
            const emptyCollection = new DataSourceRuleCollection(mockLogger, mockDataSourceRuleProvider);

            // Act & Assert
            expect(() => emptyCollection.get("any-id")).toThrow("Rule not found: any-id");
        });
    });
});
