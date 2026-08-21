import { describe, expect, it } from "vitest";

import type { IConfiguration } from "../../configuration/interfaces/configuration.interface.js";
import { createEndpoints } from "./endpoints.js";

function setupConfiguration(unasApiBase?: string): IConfiguration {
    const values: Record<string, unknown> = {};

    if (unasApiBase !== undefined) {
        values.unasApiBase = unasApiBase;
    }

    return {
        get<T>(key: string): T | undefined {
            return values[key] as T | undefined;
        },
        getOrDefault<T>(key: string, defaultValue: T): T {
            const value = values[key];
            return value !== undefined ? (value as T) : defaultValue;
        },
        getSection<T>(section: string): T | undefined {
            return values[section] as T | undefined;
        },
        has(key: string): boolean {
            return key in values;
        },
        getAll(): Record<string, unknown> {
            return { ...values };
        },
    };
}

describe("createEndpoints", () => {
    it("should create endpoints from unasApiBase", () => {
        // Arrange
        const configuration = setupConfiguration("https://api.unas.eu/shop/");

        // Act
        const endpoints = createEndpoints(configuration);

        // Assert
        expect(endpoints).toEqual({
            LOGIN: "https://api.unas.eu/shop/login",
            GET_PRODUCT_DB: "https://api.unas.eu/shop/getProductDB",
            SET_PRODUCT: "https://api.unas.eu/shop/setProduct",
            GET_WAREHOUSE: "https://api.unas.eu/shop/getWarehouse",
        });
    });

    it("should throw when unasApiBase is missing", () => {
        const configuration = setupConfiguration();

        expect(() => createEndpoints(configuration)).toThrow("Missing required configuration key: unasApiBase");
    });
});
