import { inject, injectable } from "inversify";
import { BindingKeys } from "../../types/index.js";
import { Logger } from "log4js";
import { IUnasDataSourceMapper } from "./interfaces/unas-data-source-mapper.interface.js";
import { UnasCsvColumnNames } from "./unas-csv-column-names.js";
import type { StockDto, StockSpriteParamDto } from "../dto/index.js";
import { IRepository } from "../../repository/index.js";
import { WarehouseDto } from "../dto/warehouse-dto.interface.js";
import { Util } from "../../utils/index.js";
import { DataDto } from "../dto/data-dto.interface.js";

@injectable()
export class UnasDataSourceMapper implements IUnasDataSourceMapper {
    constructor(@inject(BindingKeys.Logger) private _logger: Logger,
                @inject(BindingKeys.WarehouseRepository) private _warehouseRepository: IRepository<WarehouseDto>) {}

    public mapSku(row: Record<string, unknown>): string | undefined {
        const fieldExists = this.fieldExists(row, UnasCsvColumnNames.sku);
        if (!fieldExists) {
            return undefined;
        }

        return Util.mapping.getStringValue(row[UnasCsvColumnNames.sku]);
    }

    public mapDescription(row: Record<string, unknown>): string | undefined {
        const fieldExists = this.fieldExists(row, UnasCsvColumnNames.description);
        if (!fieldExists) {
            return undefined;
        }

        return Util.mapping.getStringValue(row[UnasCsvColumnNames.description]);
    }

    public async mapStocks(row: Record<string, unknown>): Promise<StockDto[] | undefined> {
        const result: StockDto[] = [];

        // If stock is turned off for this product 'stockMain' field will contain 'off'.
        const mainStockValue = this.getField(row, UnasCsvColumnNames.stockMain);
        if (typeof mainStockValue === "string" && mainStockValue === "off") {
            return [];
        }

        const stockMainFieldExists = this.fieldExists(row, UnasCsvColumnNames.stockMain);
        if (stockMainFieldExists) {
            const stockMain = Util.mapping.getNumberValue(row[UnasCsvColumnNames.stockMain]);
            if (stockMain !== undefined) {
                const stockDto = {
                    warehouseId: 1, // default id for main stock
                    quantity: stockMain,
                } as StockDto;

                result.push(stockDto);
            }
        }

        // Additional stock
        const warehouses = await this._warehouseRepository.getAll();
        if (!warehouses || warehouses.length === 0) {
            return result.length > 0 ? result : undefined;
        }

        for (const warehouse of warehouses) {
            const field = `${UnasCsvColumnNames.stockAdditionalPrefix}${warehouse.Name}`;
            const fieldExists = this.fieldExists(row, field);
            if (!fieldExists) {
                this._logger.warn("Stock field for warehouse not found in CSV, skipping warehouse.", { warehouseName: warehouse.Name });
                continue;
            }

            const fieldValue = Util.mapping.getNumberValue(row[field]);
            if (fieldValue === undefined) {
                this._logger.warn("Stock field value for warehouse is undefined, skipping warehouse.", { warehouseName: warehouse.Name });
                continue;
            }

            const stockDto = {
                warehouseId: warehouse.Id,
                quantity: fieldValue,
            } as StockDto;

            result.push(stockDto);
        }

        return result.length > 0 ? result : undefined;
    }

    public mapDatas(row: Record<string, unknown>): DataDto[] | undefined {
        const result: DataDto[] = [];

        const fields = [
            { id: 1, key: UnasCsvColumnNames.data1, name: "data1" },
            { id: 2, key: UnasCsvColumnNames.data2, name: "data2" },
            { id: 3, key: UnasCsvColumnNames.data3, name: "data3" },
        ];

        for (const field of fields) {
            const value = this.getField(row, field.key);
            if (typeof value === "string" && value.length !== 0) {
                result.push({ id: field.id, name: field.name, value });
            }
        }

        return result.length > 0 ? result : undefined;
    }

    // Temporary function until param management is created
    public mapStockSpriteParam(row: Record<string, unknown>): StockSpriteParamDto | undefined {
        const startsWith = `${UnasCsvColumnNames.paramPrefix}stocksprite-param`; // Temporary until param management is created
        const stockspriteParam = this.getFieldStartsWith(row, startsWith);
        if (!stockspriteParam) {
            return { description: undefined, images: undefined } as StockSpriteParamDto;
        }
        const stockspriteParamValue = Util.mapping.getStringValue(stockspriteParam);
        if (!stockspriteParamValue) {
            return { description: undefined, images: undefined } as StockSpriteParamDto;
        }
        return this.parseStockSpriteParam(stockspriteParamValue);
    }

    private fieldExists(row: Record<string, unknown>, fieldName: string): boolean {
        if (!row.hasOwnProperty(fieldName)) {
            return false;
        }
        return true;
    }

    private getFieldStartsWith(row: Record<string, unknown>, prefix: string): unknown {
        const matches = Object.keys(row).filter((key) => key.startsWith(prefix));
        if (matches.length === 1) {
            return row[matches[0]];
        }
        if (matches.length > 1) {
            this._logger.warn("Multiple fields found for prefix, returning undefined.", { fieldPrefix: prefix });
        }
        return undefined;
    }

    private getField(row: Record<string, unknown>, fieldName: string): unknown {
        return Object.prototype.hasOwnProperty.call(row, fieldName) ? row[fieldName] : undefined;
    }

    private parseStockSpriteParam(value: string): StockSpriteParamDto {
        let description = false;
        let images = false;

        for (const item of value.split(",")) {
            const [key, rawValue] = item.split(":");
            if (key.trim() === "description") description = rawValue?.trim() === "1";
            if (key.trim() === "images") images = rawValue?.trim() === "1";
        }

        const dto: StockSpriteParamDto = {
            description,
            images,
        };
        return dto;
    }
}