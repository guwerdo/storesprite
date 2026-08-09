import { describe, expect, it } from "vitest";

import { stocksValid } from "./stocks-valid.js";
import { IStockDto } from "./unas/dto/interfaces/stock-dto.interface.js";

describe("validate", () => {
    describe("stocksValid", () => {
        it("should return true when both arrays are empty", () => {
            // Arrange
            const localStocks: IStockDto[] = [];
            const unasStocks: IStockDto[] = [];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when local stocks are empty and UNAS stocks are not empty", () => {
            // Arrange
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
            ];

            // Act
            const result = stocksValid([], unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return true when local and UNAS stocks match exactly", () => {
            // Arrange
            const localStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
            ];
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
            ];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when local and UNAS stocks have different quantities for the same warehouse", () => {
            // Arrange
            const localStocks: IStockDto[] = [{ warehouseId: 1, quantity: 100 }];
            const unasStocks: IStockDto[] = [{ warehouseId: 1, quantity: 50 }];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when local stock warehouse not found in UNAS and local quantity is 0", () => {
            // Arrange
            const localStocks: IStockDto[] = [{ warehouseId: 3, quantity: 0 }];
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
            ];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when local stock warehouse not found in UNAS and local quantity is not 0", () => {
            // Arrange
            const localStocks: IStockDto[] = [{ warehouseId: 3, quantity: 10 }];
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
            ];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false with multiple warehouses when local has extra warehouse", () => {
            // Arrange
            const localStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
                { warehouseId: 3, quantity: 0 },
            ];
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
            ];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when one of multiple warehouses does not match", () => {
            // Arrange
            const localStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 50 },
            ];
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 75 },
            ];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should handle undefined quantities", () => {
            // Arrange
            const localStocks: IStockDto[] = [{ warehouseId: 1, quantity: undefined }];
            const unasStocks: IStockDto[] = [{ warehouseId: 1, quantity: undefined }];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(true);
        });

        it("should return false when quantities differ with undefined", () => {
            // Arrange
            const localStocks: IStockDto[] = [{ warehouseId: 1, quantity: 100 }];
            const unasStocks: IStockDto[] = [{ warehouseId: 1, quantity: undefined }];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when local stock has quantity 0 and warehouse not in UNAS", () => {
            // Arrange
            const localStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 0 },
            ];
            const unasStocks: IStockDto[] = [{ warehouseId: 1, quantity: 100 }];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false when UNAS has warehouses not in local with non-zero quantities", () => {
            // Arrange
            const localStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 101 },
            ];
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 101 },
                { warehouseId: 3, quantity: 101 },
                { warehouseId: 4, quantity: 101 },
            ];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(false);
        });

        it("should return true when UNAS extra warehouses have zero quantities", () => {
            // Arrange
            const localStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 101 },
            ];
            const unasStocks: IStockDto[] = [
                { warehouseId: 1, quantity: 100 },
                { warehouseId: 2, quantity: 101 },
                { warehouseId: 3, quantity: 0 },
                { warehouseId: 4, quantity: 0 },
            ];

            // Act
            const result = stocksValid(localStocks, unasStocks);

            // Assert
            expect(result).toBe(true);
        });
    });
});
