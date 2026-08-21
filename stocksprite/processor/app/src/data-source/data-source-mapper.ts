import jsonLogic from "json-logic-js";
import { inject, injectable } from "inversify";
import { BindingKeys } from "../types/index.js";
import type { Logger } from "log4js";
import { IDataSourceFieldMapping } from "./interfaces/product/data-source-field-mapping.interface.js";
import type { IStockDto } from "../unas/dto/interfaces/index.js";
import { IDataSourceMapper } from "./interfaces/index.js";
import type { IDataSourceRuleCollection } from "./interfaces/index.js";
import { Util } from "../utils/index.js";
import stringify from "fast-json-stable-stringify";
import { IDataDto } from "../unas/dto/interfaces/index.js";
import { IDataSourceDataMapping, IDataSourceStockMapping } from "./interfaces/index.js";

@injectable()
export class DataSourceMapper implements IDataSourceMapper {

    constructor(
        @inject(BindingKeys.Logger) private _logger: Logger,
        @inject(BindingKeys.DataSourceRuleCollection) private _dataSourceRuleCollection: IDataSourceRuleCollection
    ) {}

    public async mapField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<string | undefined> {
        this.validateFieldMapping(row, mapping);
        const mappedFields = this.getMappedFields(row, mapping);

        if (mapping.ruleId) {
            const ruleResult = await this.applyRule(mapping.ruleId, mappedFields);
            return Util.mapping.getStringValue(ruleResult);
        }
        else {
            return Util.mapping.getStringValue(this.getSingleRecordEntry(mappedFields));
        }
    }

    /* TODO: remove it later
    public async mapImagesField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<IImageDto[] | undefined> {
        this.validateFieldMapping(row, mapping);
        const result: IImageDto[] = [];
        const mappedFields = this.getMappedFields(row, mapping);

        if (mapping.fn) {
            const mappingFnResults = await this.callMappingFunction(mapping.fn, mappedFields);

            if (!Array.isArray(mappingFnResults)) {
                throw new Error(`Mapping function result is not an array. Result: ${stringify(mappingFnResults)}`);
            }

            for (const mappingFnResult of mappingFnResults as unknown[]) {
                if (!Util.mapping.isObject(mappingFnResult)) {
                    throw new Error(`Mapping function result is not an object. Result: ${stringify(mappingFnResult)}`);
                }

                if (Util.mapping.isObject(mappingFnResult)) {
                    const fnResult = mappingFnResult as Record<string, unknown>;
                    const imageDto: IImageDto = {} as IImageDto;

                    const uri = "uri" in fnResult ? Util.mapping.getStringValue(fnResult.uri) : undefined;
                    imageDto.uri = uri && Util.isValidUrl(uri) ? uri : undefined;

                    imageDto.title = "title" in fnResult ? Util.mapping.getStringValue(fnResult.title) : undefined;
                    imageDto.description = "description" in fnResult ? Util.mapping.getStringValue(fnResult.description) : undefined;
                    imageDto.fileName = "fileName" in fnResult ? Util.mapping.getStringValue(fnResult.fileName) : undefined;
                    imageDto.order = "order" in fnResult ? Util.mapping.getNumberValue(fnResult.order) : undefined;
                    result.push(imageDto);
                }
            }
        }
        else {
            throw new Error("No mapping function was defined for images in data-source.json");
        }

        return result.length > 0 ? result : undefined;
    }
    */

    public async mapStocksField(row: Record<string, string>, mappings: IDataSourceStockMapping[]): Promise<IStockDto[] | undefined> {
        const result: IStockDto[] = [];
        this.validateStocksFieldMapping(row, mappings);

        for (const mapping of mappings) {
            const mappedFields = this.getMappedFields(row, mapping.mapping);

            if (mapping.mapping.ruleId) {
                const ruleResult = await this.applyRule(mapping.mapping.ruleId, mappedFields);
                let quantity = Util.mapping.getNumberValue(ruleResult);

                if (quantity === undefined) { // quantity can be zero! dont use 'if (quantity)'
                    // If quantity is undefined set quantity to 0. This way the stock for this warehouse will be 
                    // set to 0 in Unas and the Unas product page will not show the stocks for this warehouse.
                    // This eliminates the case when there was a stock value defined and the CSV earlier, but it changed 
                    // to empty. In this case the previusly set stock value would remain in Unas.
                    quantity = 0;
                }

                const stockDto = {
                    warehouseId: mapping.warehouseId,
                    quantity: Util.mapping.negativeToZero(quantity),
                } as IStockDto;

                result.push(stockDto);
            }
            else
            {
                let quantity = Util.mapping.getNumberValue(this.getSingleRecordEntry(mappedFields));
                if (quantity === undefined) { // quantity can be zero! dont use 'if (quantity)'
                    // If quantity is undefined set quantity to 0. This way the stock for this warehouse will be 
                    // set to 0 in Unas and the Unas product page will not show the stocks for this warehouse.
                    // This eliminates the case when there was a stock value defined and the CSV earlier, but it changed 
                    // to empty. In this case the previusly set stock value would remain in Unas.
                    quantity = 0;
                }

                const stockDto =  {
                    warehouseId: mapping.warehouseId,
                    quantity: Util.mapping.negativeToZero(quantity),
                } as IStockDto;

                result.push(stockDto);
            }
        }
        return result.length > 0 ? result : undefined;
    }

    public async mapDatasField(row: Record<string, string>, mappings: IDataSourceDataMapping[]): Promise<IDataDto[] | undefined> {
        const result: IDataDto[] = [];
        this.validateDatasFieldMapping(row, mappings);

        for (const mapping of mappings) {
            const mappedFields = this.getMappedFields(row, mapping.mapping);

            if (mapping.mapping.ruleId) {
                const ruleResult = await this.applyRule(mapping.mapping.ruleId, mappedFields);
                const value = Util.mapping.getStringValue(ruleResult) ?? "";

                const dataDto = {
                    id: mapping.id,
                    value: value,
                } as IDataDto;

                result.push(dataDto);
            }
            else
            {
                const value = Util.mapping.getStringValue(this.getSingleRecordEntry(mappedFields)) ?? "";
                const dataDto =  {
                    id: mapping.id,
                    value: value,
                } as IDataDto;

                result.push(dataDto);
            }
        }
        return result.length > 0 ? result : undefined;
    }

    private validateStocksFieldMapping(row: Record<string, string>, mappings: IDataSourceStockMapping[]) {
        for (const mapping of mappings) {
            const warehouseId = mapping.warehouseId;
            // TODO Validate if warehouse id exists in unas, read and save warehouse ids to redis when this script starts
            if (!warehouseId) {
                throw new Error(`Warehouse ID is not found in Unas webshop: ${stringify(mapping)}`);
            }
            this.validateFieldMapping(row, mapping.mapping);
        }
    }

    private validateDatasFieldMapping(row: Record<string, string>, mappings: IDataSourceDataMapping[]) {
        for (const mapping of mappings) {
            const id = mapping.id;
            if (!id) {
                throw new Error(`Data id is not found: ${stringify(mapping)}`);
            }
            this.validateFieldMapping(row, mapping.mapping);
        }
    }

    private validateFieldMapping(row: Record<string, string>, mapping: IDataSourceFieldMapping) {
        // Validate the mapping field exist
        if (mapping.fields.length === 0) {
            throw new Error(`No fields defined for mapping: ${stringify(mapping)}`);
        }

        // Validate if no mapping function exists but there are multiple fields
        if (!mapping.ruleId && mapping.fields.length > 1) {
            throw new Error(`No mapping function defined for multiple fields: ${stringify(mapping)}`);
        }

        // Validate the mapping fields exist in the row
        for (const field of mapping.fields) {
            if (!row.hasOwnProperty(field)) {
                throw new Error(`Mapping field not found in datasource: ${field}`);
            }
        }
    }

    private getMappedFields(row: Record<string, string>, mapping: IDataSourceFieldMapping): Record<string, string> {
        return Object.fromEntries(
            mapping.fields.map((field) => [field, row[field]])
        );
    }

    private getSingleRecordEntry(mappedFields: Record<string, string>): string | undefined {
        const values = Object.values(mappedFields);
        if (values.length !== 1) {
            const message = values.length === 0 ? "Record has no entries." : "Record has more than one entry.";
            throw new Error(message);
        }

        const value = values[0];
        if (value == null || value.trim().length === 0) {
            return undefined;
        }
        return value;
    }

    private applyRule(ruleId: string, fields: Record<string, string>): unknown {
        const rule = this._dataSourceRuleCollection.get(ruleId);
        return jsonLogic.apply(rule, fields);
    }
}


