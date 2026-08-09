import { IStockDto } from "./unas/dto/interfaces/stock-dto.interface.js";

export function stocksValid(localStocks: IStockDto[], unasStocks: IStockDto[]): boolean {
    // If local has no stocks, UNAS must also be empty to be considered valid.
    if (localStocks.length === 0) {
        return unasStocks.length === 0;
    }

    // Every local warehouse must exist in UNAS with the same quantity.
    for (const localStock of localStocks) {
        const unasStock = unasStocks.find((stock) => stock.warehouseId === localStock.warehouseId);
        if (!unasStock || unasStock.quantity !== localStock.quantity) {
            return false;
        }
    }

    // Any extra UNAS warehouse is only allowed when its quantity is zero.
    for (const unasStock of unasStocks) {
        const localStock = localStocks.find((stock) => stock.warehouseId === unasStock.warehouseId);
        if (!localStock && unasStock.quantity !== 0) {
            return false;
        }
    }

    return true;
}
