import { inject, injectable } from "inversify";
import type { ICsvStreamProcessor } from "./interfaces/csv-stream-processor.interface.js";
import type { Logger } from "log4js";
import { Queue } from "bullmq";
import { BindingKeys } from "../types/index.js";
import { IDataSourceProductMapping } from "../data-source/interfaces/product/data-source-product-mapping.interface.js";
import { IProductDto } from "../unas/dto/interfaces/index.js";
import type { IDataSourceMapper } from "../data-source/index.js";
import type { IRepository } from "../repository/interfaces/index.js";
import { Util } from "../utils/index.js";
import stringify from "fast-json-stable-stringify";
import type { ICsvStreamFactory } from "./index.js";

@injectable()
export class CsvStreamProcessor implements ICsvStreamProcessor {
    constructor(
        @inject(BindingKeys.ParsedQueue) private _parsedQueue: Queue,
        @inject(BindingKeys.Logger) private _logger: Logger,
        @inject(BindingKeys.ICsvStreamFactory) private _csvStreamFactory: ICsvStreamFactory,
        @inject(BindingKeys.DataSourceMapper) private _dataSourceMapper: IDataSourceMapper,
        @inject(BindingKeys.UnasCacheRepository) private _unasCacheRepository: IRepository<IProductDto>
    ) {}

    public async process(stream: NodeJS.ReadableStream, datasourceId: string, dataSourceProductMapping: IDataSourceProductMapping): Promise<void> {
        this._logger.info("Start reading data stream", { datasourceId: datasourceId });
        let queuedItems = 0;

        const parser = this._csvStreamFactory.createStream() as NodeJS.WritableStream & AsyncIterable<Record<string, string>>;
        try {
            stream.pipe(parser);
            for await (const row of parser) {
                const handled = await this.handleStreamData(row, dataSourceProductMapping, datasourceId);
                if (handled) {
                    queuedItems++;
                }
            }
            this._logger.info("Products queued matching webshop", { items: queuedItems, datasourceId: datasourceId });
        } catch (error) {
            await this._parsedQueue.close();
            this._logger.error("Error while reading the stream", { error: Util.stringifyError(error as Error), datasourceId: datasourceId });
            throw error;
        }
    }

    public async close(): Promise<void> {
        await this._parsedQueue.close();
    }

    private async handleStreamData(row: Record<string, string>, dataSourceProductMapping: IDataSourceProductMapping, datasourceId: string): Promise<boolean> {
        const product = await this.mapToProductDto(row, dataSourceProductMapping);
        if (!product.sku) {
            this._logger.warn("Skipping product without sku", { datasourceId: datasourceId });
            return false;
        }

        const cachedProduct = await this._unasCacheRepository.get(product.sku);
        if (!cachedProduct) {
            this._logger.info("Skipping product missing from cache", { datasourceId: datasourceId, sku: product.sku });
            return false;
        }

        await this._parsedQueue.add("task", product);
        this.logQueuedProduct(datasourceId, product);
        return true;
    }

    private async mapToProductDto(row: Record<string, string>, dataSourceProductMapping: IDataSourceProductMapping): Promise<IProductDto> {
        return {
            sku: await this._dataSourceMapper.mapField(row, dataSourceProductMapping.sku),
            /* TODO: remove it later, images and is not used anymore
            description: dataSourceProductMapping.descriptionLong
                ? await this._dataSourceMapper.mapField(row, dataSourceProductMapping.descriptionLong)
                : undefined,
            images: dataSourceProductMapping.images
                ? await this._dataSourceMapper.mapImagesField(row, dataSourceProductMapping.images)
                : undefined,
            */
            stocks: dataSourceProductMapping.stocks
                ? await this._dataSourceMapper.mapStocksField(row, dataSourceProductMapping.stocks)
                : undefined,
            datas: dataSourceProductMapping.datas
                ? await this._dataSourceMapper.mapDatasField(row, dataSourceProductMapping.datas)
                : undefined
        } as IProductDto;
    }

    private logQueuedProduct(datasourceId: string, product: IProductDto): void {
        const descriptionMaxLength = 8;
        const productClone = JSON.parse(JSON.stringify(product)) as IProductDto;
        if (typeof productClone.description === "string") {
            productClone.description =
                productClone.description.length > descriptionMaxLength
                    ? productClone.description.substring(0, descriptionMaxLength) + "..."
                    : productClone.description;
        }
        this._logger.info(`Queuing product (datasourceId: ${datasourceId}):`, { product: stringify(productClone) });
    }
}