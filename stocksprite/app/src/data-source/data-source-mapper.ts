import { inject, injectable } from "inversify";
import { BindingKeys } from "../types/index.js";
import { Logger } from "log4js";
import { IDataSourceFieldMapping } from "./interfaces/product/data-source-field-mapping.interface.js";
import type { ImageDto, StockDto } from "../unas/dto/index.js";
import { IDataSourceMapper } from "./index.js";
import { Util } from "../utils/index.js";
import { IDataSourceStockMapping } from "./interfaces/product/data-source-stock-mapping.interface.js";
import stringify from "fast-json-stable-stringify";
import { DataDto } from "../unas/dto/data-dto.interface.js";
import { IDataSourceDataMapping } from "./interfaces/product/data-source-data-mapping.interface.js";

@injectable()
export class DataSourceMapper implements IDataSourceMapper {

    constructor(@inject(BindingKeys.Logger) private _logger: Logger) {}
    
    public async mapField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<string | undefined> {
        this.validateFieldMapping(row, mapping);
        const mappedFields = this.getMappedFields(row, mapping);

        if (mapping.fn) {
            const mappingFnResult = await this.callMappingFunction(mapping.fn, mappedFields);
            return Util.mapping.getStringValue(mappingFnResult);
        }
        else {
            return Util.mapping.getStringValue(this.getSingleRecordEntry(mappedFields));
        }
    }

    public async mapImagesField(row: Record<string, string>, mapping: IDataSourceFieldMapping): Promise<ImageDto[] | undefined> {
        this.validateFieldMapping(row, mapping);
        const result: ImageDto[] = [];
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
                    const imageDto: ImageDto = {} as ImageDto;

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

    public async mapStocksField(row: Record<string, string>, mappings: IDataSourceStockMapping[]): Promise<StockDto[] | undefined> {
        const result: StockDto[] = [];
        this.validateStocksFieldMapping(row, mappings);

        for (const mapping of mappings) {
            const mappedFields = this.getMappedFields(row, mapping.mapping);

            if (mapping.mapping.fn) {
                const mappingFnResult = await this.callMappingFunction(mapping.mapping.fn, mappedFields);
                const quantity = Util.mapping.getNumberValue(mappingFnResult);

                if (quantity) {
                    const stockDto = {
                        warehouseId: mapping.warehouseId,
                        quantity: Util.mapping.negativeToZero(quantity),
                    } as StockDto;

                    result.push(stockDto);
                }
            }
            else
            {
                const quantity = Util.mapping.getNumberValue(this.getSingleRecordEntry(mappedFields));
                if (quantity !== undefined) { // quantity can be zero! dont use 'if (quantity)'
                    const stockDto =  {
                        warehouseId: mapping.warehouseId,
                        quantity: Util.mapping.negativeToZero(quantity),
                    } as StockDto;

                    result.push(stockDto);
                }
            }
        }
        return result.length > 0 ? result : undefined;
    }

    public async mapDatasField(row: Record<string, string>, mappings: IDataSourceDataMapping[]): Promise<DataDto[] | undefined> {
        const result: DataDto[] = [];
        this.validateDatasFieldMapping(row, mappings);

        for (const mapping of mappings) {
            const mappedFields = this.getMappedFields(row, mapping.mapping);

            if (mapping.mapping.fn) {
                const mappingFnResult = await this.callMappingFunction(mapping.mapping.fn, mappedFields);
                const value = Util.mapping.getStringValue(mappingFnResult);

                if (value) {
                    const dataDto = {
                        id: mapping.id,
                        name: mapping.name,
                        value: value,
                    } as DataDto;

                    result.push(dataDto);
                }
            }
            else
            {
                const value = Util.mapping.getStringValue(this.getSingleRecordEntry(mappedFields));
                if (value) {
                    const dataDto =  {
                        id: mapping.id,
                        name: mapping.name,
                        value: value,
                    } as DataDto;

                    result.push(dataDto);
                }
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
        if (!mapping.fn && mapping.fields.length > 1) {
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

    /* eslint-disable */
    private async callMappingFunction(fnName: string, fields: Record<string, string>): Promise<unknown> {
        // @ts-expect-error: dynamic import of untyped JS mapping module by design
        const fnModule = await import("../../data-source/mapping-functions.js");
        const fn = fnModule[fnName];
        if (typeof fn !== "function") {
            throw new Error(`Mapping function not found: ${fnName}`);
        }

        // Ensure the mapping function declares exactly one parameter
        if (fn.length !== 1) {
            throw new Error(`Mapping function must accept exactly one parameter: ${fnName}, expected: 1, actual: ${fn.length}`);
        }

        // Pass a single argument: the dictionary of fields
        return await fn(fields);
    }
    /* eslint-enable */
}


