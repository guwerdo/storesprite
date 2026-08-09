import { inject, injectable } from "inversify";
import { IQueuePublisher } from "./interfaces/queue-publisher.interface.js";
import { Logger } from "log4js";
import { Queue } from "bullmq";
import { BindingKeys } from "../types/index.js";
import { IDataSourceProductMapping } from "../data-source/interfaces/product/data-source-product-mapping.interface.js";
import { ProductDto } from "../unas/dto/index.js";
import { IDataSourceMapper } from "../data-source/index.js";
import { Util } from "../utils/index.js";
import stringify from "fast-json-stable-stringify";
import { ICsvStreamFactory } from "./index.js";

@injectable()
export class QueuePublisher implements IQueuePublisher {
    constructor(
        @inject(Queue) private _queue: Queue,
        @inject(BindingKeys.Logger) private _logger: Logger,
        @inject(BindingKeys.ICsvStreamFactory) private _csvStreamFactory: ICsvStreamFactory,
        @inject(BindingKeys.DataSourceMapper) private _dataSourceMapper: IDataSourceMapper
    ) {}

    public async publish(stream: NodeJS.ReadableStream, datasourceId: string, dataSourceProductMapping: IDataSourceProductMapping): Promise<void> {
        this._logger.info("Start reading data stream", { datasourceId: datasourceId });
        let publishedItems = 0;

        const parser = this._csvStreamFactory.createStream() as NodeJS.WritableStream & AsyncIterable<Record<string, string>>;
        try {
            stream.pipe(parser);
            for await (const row of parser) {
                await this.handleStreamData(row, dataSourceProductMapping);
                publishedItems++;
            }
            this._logger.info("Published items", { items: publishedItems, datasourceId: datasourceId });
        } catch (error) {
            await this._queue.close();
            this._logger.error("Error while reading the stream", { error: Util.stringifyError(error as Error), datasourceId: datasourceId });
            throw error;
        }
    }

    public async close(): Promise<void> {
        await this._queue.close();
    }

    private async handleStreamData(row: Record<string, string>, dataSourceProductMapping: IDataSourceProductMapping): Promise<void> {
        const product = await this.mapToProductDto(row, dataSourceProductMapping);
        await this._queue.add("task", product);
        this.logPublishedProduct(product);
    }

    private async mapToProductDto(row: Record<string, string>, dataSourceProductMapping: IDataSourceProductMapping): Promise<ProductDto> {
        return {
            sku: await this._dataSourceMapper.mapField(row, dataSourceProductMapping.sku),
            description: dataSourceProductMapping.descriptionLong
                ? await this._dataSourceMapper.mapField(row, dataSourceProductMapping.descriptionLong)
                : undefined,
            images: dataSourceProductMapping.images
                ? await this._dataSourceMapper.mapImagesField(row, dataSourceProductMapping.images)
                : undefined,
            stocks: dataSourceProductMapping.stocks
                ? await this._dataSourceMapper.mapStocksField(row, dataSourceProductMapping.stocks)
                : undefined,
            datas: dataSourceProductMapping.datas
                ? await this._dataSourceMapper.mapDatasField(row, dataSourceProductMapping.datas)
                : undefined
        } as ProductDto;
    }

    private logPublishedProduct(product: ProductDto): void {
        const descriptionMaxLength = 8;
        const productClone = JSON.parse(JSON.stringify(product)) as ProductDto;
        if (typeof productClone.description === "string") {
            productClone.description =
                productClone.description.length > descriptionMaxLength
                    ? productClone.description.substring(0, descriptionMaxLength) + "..."
                    : productClone.description;
        }
        console.log("Publishing product element:", stringify(productClone));
    }
}