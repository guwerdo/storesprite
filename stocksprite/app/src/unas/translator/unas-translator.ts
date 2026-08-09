import { inject, injectable } from "inversify";
import { IUnasTranslator } from "./interfaces/unas-translator.interface.js";
import type { Logger } from "log4js";
import { IProductElement, IDataElement, IImageElement, IImagesElement, IStockElement } from "../client/request/builder/interfaces/index.js";
import { SetProductRequestBuilder } from "../client/request/index.js";
import { Util } from "../../utils/index.js";
import { UnasImageType } from "../../types/unas-image.type.js";
import type { IAxiosHttpClient } from "../../http-client/interfaces/http-client.interface.js";
import { BindingKeys } from "../../types/index.js";
import type { IRepository } from "../../repository/interfaces/index.js";
import { normalize, mergePlainProductDto, comparePlainProductDto } from "../dto/index.js";
import {IImageDto, IProductDto, IDtoDifference, IStockDto} from "../dto/interfaces/index.js";
import stringify from "fast-json-stable-stringify";
import { Queue } from "bullmq";

@injectable()
export class UnasTranslator implements IUnasTranslator {
    constructor(@inject(BindingKeys.Logger) private _logger: Logger,
                @inject(BindingKeys.TranslatedQueue) private _translatedQueue: Queue,
                @inject(BindingKeys.IAxiosHttpClient) private httpClient: IAxiosHttpClient,
                @inject(BindingKeys.UnasCacheRepository) private _unasCacheRepository: IRepository<IProductDto>,
                @inject(BindingKeys.ValidatedUrlsRepository) private _validatedUrlsRepository: IRepository<string>,
    ) {}

    async translate(sourceProductDto: IProductDto, force = false): Promise<void> {
        if (!sourceProductDto.sku) {
            this._logger.error("Product SKU is missing", { product: sourceProductDto });
            return;
        }

        const targetProductDto = await this._unasCacheRepository.get(sourceProductDto.sku);
        if (!targetProductDto) {
            return; // Product does not exist in Unas, skip update
        }

        const result = this.createProductXmlElement(sourceProductDto, targetProductDto, force);
        if (!result) {
            console.log("Product update not required");
            return;
        }
        
        const [productXmlElement, mergedProductDto] = result;
        await this._translatedQueue.add("task", { productXml: productXmlElement, productDto: mergedProductDto });
    }

    createProductXmlElement(sourceProductDto: IProductDto, targetProductDto: IProductDto, force = false): [IProductElement, IProductDto] | undefined {
        // We dont update these fields right now, ignore them
        sourceProductDto.description = undefined;
        sourceProductDto.images = undefined;
        targetProductDto.description = undefined;
        targetProductDto.images = undefined;

        const normalizedSourceDto = normalize(sourceProductDto) as IProductDto;
        const normalizedTargetDto = normalize(targetProductDto) as IProductDto;

        let stockElements: IStockElement[] | undefined = undefined;
        let dataElements: IDataElement[] | undefined = undefined;
        const [mergedProductDto, productDtoDiff] = this.mergeAndCompareNormalized(normalizedSourceDto, normalizedTargetDto);

        if (mergedProductDto.stocks && sourceProductDto.stocks) {
            mergedProductDto.stocks = this.resetAllStocksOtherThanSourceStock(mergedProductDto.stocks, sourceProductDto.stocks);
        }

        if (mergedProductDto.sku === undefined) {
            throw new Error("Product SKU is missing from mergedProductDto");
        }

        // Only create update elements if there are differences or if force update is requested
        if (productDtoDiff.length !== 0 || force) {
            stockElements = this.createStockElements(mergedProductDto);
            dataElements = this.createDataElements(mergedProductDto);
        }

        if (stockElements === undefined && 
            dataElements === undefined) {
            return undefined; // Update is not required.
        }

        // Log what is being updated
        const updatedFields: string[] = [];
        if (stockElements !== undefined) { updatedFields.push("stocks"); }
        if (dataElements !== undefined) { updatedFields.push("datas"); }
        this._logger.info("Product update required", { sku: mergedProductDto.sku, updatedFields: stringify(updatedFields) });

        const productElement = SetProductRequestBuilder.createProductElement(mergedProductDto.sku, undefined, stockElements, undefined, dataElements);
        return [productElement, mergedProductDto];
    }

    async createImagesElement(productSku: string, imageDtos: IImageDto[]): Promise<IImagesElement | undefined> {
        if (!await this.verifyImageUrl(imageDtos)) {
            throw new Error("Error verifying image URLs: product image url not reachable.");
        }

        let index = 0;
        let defaultFileName = "";
        const imageElements: IImageElement[] = [];
        for (const image of imageDtos) {
            const unasImageType: UnasImageType = index === 0 ? "base" : "alt"; // The first image is the 'base' image, the rest are 'alt' images
            const title = image.title ? image.title : "";
            const fileName = image.fileName ? image.fileName : "";
            if (!image.uri) {
                throw new Error("Product image uri is missing from productDto");
            }

            if (!defaultFileName) defaultFileName = index === 0 ? fileName : "";
            const imageElement = SetProductRequestBuilder.createImageElement(unasImageType, index, image.uri, fileName, title, image.uri);
            imageElements.push(imageElement);
            index++;
        }

        if (imageDtos.length === 0) {
            return undefined;
        }

        const version = Util.getCurrentUtcDate();
        return SetProductRequestBuilder.createImagesElement(defaultFileName, productSku, 1, version, imageElements);
    }

    createStockElements(mergedProductDto: IProductDto): IStockElement[] | undefined {
        if (mergedProductDto.stocks) {
            return SetProductRequestBuilder.createStockElement(mergedProductDto.stocks);
        }
        return undefined;
    }

    createDataElements(mergedProductDto: IProductDto): IDataElement[] | undefined {
        if (mergedProductDto.datas) {
            return SetProductRequestBuilder.createDataElement(mergedProductDto.datas);
        }
        return undefined
    }

    resetAllStocksOtherThanSourceStock(mergedStockDtos: IStockDto[], sourceStockDtos: IStockDto[]): IStockDto[] {
        const sourceStockMap = new Map(sourceStockDtos.map(s => [s.warehouseId, s.quantity]));
        return mergedStockDtos.map(stock => ({
            warehouseId: stock.warehouseId,
            quantity: sourceStockMap.get(stock.warehouseId) ?? 0
        }));
    }

    mergeAndCompareNormalized(normalizedSourceDto: IProductDto, normalizedTargetDto: IProductDto): [IProductDto, IDtoDifference[]] {
        const mergedProductDto = mergePlainProductDto(normalizedTargetDto, normalizedSourceDto);
        const normalizedMergedProductDto = normalize(mergedProductDto) as IProductDto;
        return [normalizedMergedProductDto, comparePlainProductDto(normalizedTargetDto, normalizedMergedProductDto)];
    }

    async verifyImageUrl(imageDtos: IImageDto[]): Promise<boolean> {
        const imageUrls: string[] = [];
        for (const image of imageDtos) {
            if (!image.uri) {
                return false;
            }
            imageUrls.push(image.uri);
        }

        for (const imageUrl of imageUrls) {
            try {
                if (await this._validatedUrlsRepository.exists("", imageUrl)) {
                    continue;
                }

                const response = await this.httpClient.instance.head(imageUrl);
                if (response.status !== 200) {
                    return false;
                } else {
                    await this._validatedUrlsRepository.add("", imageUrl);
                }
            } catch (error) {
                return false;
            }
        }
        return true;
    }
}
