import { inject, injectable } from "inversify";
import { IUnasUpdater } from "./interfaces/unas-updater.interface.js";
import { Logger } from "log4js";
import { IDataElement, IDescriptionElement, IImageElement, IImagesElement, IParamElement, IStockElement, SetProductRequestBuilder } from "../client/request/index.js";
import { Util } from "../../utils/index.js";
import { UnasImageType } from "../../types/unas-image.type.js";
import { IAxiosHttpClient } from "../../http-client/interfaces/http-client.interface.js";
import { IUnasClient } from "../client/index.js";
import { UpdateBufferItem } from "./interfaces/update-buffer-item.interface.js";
import { AxiosError } from "axios";
import { BindingKeys } from "../../types/index.js";
import { IRepository } from "../../repository/index.js";
import { normalize, mergePlainProductDto, comparePlainProductDto, DtoDifference, ImageDto, ProductDto, StockDto, DataDto, StockSpriteParamDto } from "../dto/index.js";
import stringify from "fast-json-stable-stringify";

@injectable()
export class UnasUpdater implements IUnasUpdater {
    private _setProductRequestBuilder: SetProductRequestBuilder = new SetProductRequestBuilder();
    private _updateBuffer: UpdateBufferItem[] = [];
    private readonly _updateBufferSize = 100;
    private readonly _updateBufferTimeout = 20; // seconds
    private _updateBufferTimer: NodeJS.Timeout | undefined;

    constructor(@inject(BindingKeys.Logger) private _logger: Logger,
                @inject(BindingKeys.IAxiosHttpClient) private httpClient: IAxiosHttpClient,
                @inject(BindingKeys.IUnasClient) private unasClient: IUnasClient,
                @inject(BindingKeys.UnasCacheRepository) private _unasCacheRepository: IRepository<ProductDto>,
                @inject(BindingKeys.ValidatedUrlsRepository) private _validatedUrlsRepository: IRepository<string>,
    ) {}

    async update(sourceProductDto: ProductDto): Promise<void> {
        if (!sourceProductDto.sku) {
            this._logger.error("Product SKU is missing", { product: sourceProductDto });
            return;
        }

        const targetProductDto = await this._unasCacheRepository.get(sourceProductDto.sku);
        if (!targetProductDto) {
            return; // Product does not exist in Unas, skip update
        }

        // Cleanup source and target DTOs and remove ondemand fields for comparison
        const normalizedSourceDto = this.normalizeAndRemoveOndemandFields(sourceProductDto);
        const normalizedTargetDto = this.normalizeAndRemoveOndemandFields(targetProductDto);

        // Compare normal fields
        let stockElements: IStockElement[] | undefined = undefined;
        let dataElements: IDataElement[] | undefined = undefined;
        const [mergedProductDto, normalFieldDiff] = this.compareMergeNormalFields(normalizedSourceDto, normalizedTargetDto);

        if (mergedProductDto.sku === undefined) {
            throw new Error("Product SKU is missing from mergedProductDto");
        }

        if (normalFieldDiff.length !== 0) {
            stockElements = this.createStockElements(mergedProductDto, normalFieldDiff);
            dataElements = this.createDataElements(mergedProductDto, normalFieldDiff);
            // Add other normal fields here in the future if needed...
        }

        // Update on demand fields if needed (updates mergeProductDto)
        const [descriptionElement, imagesElement, paramElements] = await this.updateOnDemandFields(mergedProductDto, sourceProductDto, targetProductDto);

        if (descriptionElement === undefined && imagesElement === undefined && paramElements === undefined && stockElements === undefined) {
            console.log("Product update not required", { sku: mergedProductDto.sku });
            return; // Update is not required.
        }

        // Log what is being updated
        const updatedFields: string[] = [];
        if (descriptionElement !== undefined) { updatedFields.push("description"); }
        if (imagesElement !== undefined) { updatedFields.push("images"); }
        if (paramElements !== undefined) { updatedFields.push("params"); }
        if (stockElements !== undefined) { updatedFields.push("stocks"); }
        if (dataElements !== undefined) { updatedFields.push("datas"); }
        this._logger.info("Product update required", { sku: mergedProductDto.sku, updatedFields: stringify(updatedFields) });

        // Stop update buffer timer if it is running
        this.resetBufferedUpdateTimer();

        // Create product XML element and add to buffer
        const productXmlElement = this._setProductRequestBuilder.createProductElement(mergedProductDto.sku, descriptionElement, stockElements, paramElements, imagesElement, dataElements);
        this._updateBuffer.push({ productXml: productXmlElement, productDto: this.normalizeAndRemoveOndemandFields(mergedProductDto) });

        // Send updates if buffer full, otherwise start timeout to send later if there are remaining updates in the buffer.
        await this.sendBufferedUpdates();
        this.sendRemainingBufferedUpdatesAfterTimeout();
    }

    normalizeAndRemoveOndemandFields(productDto: ProductDto): ProductDto {
        const normalizedProductDto = normalize(productDto) as ProductDto;
        delete normalizedProductDto.description;
        delete normalizedProductDto.images;
        return normalizedProductDto;
    }

    compareMergeNormalFields(normalizedSourceDto: ProductDto, normalizedTargetDto: ProductDto): [ProductDto, DtoDifference[]] {
        const mergedProductDto = mergePlainProductDto(normalizedTargetDto, normalizedSourceDto);
        const normalizedMergedProductDto = normalize(mergedProductDto) as ProductDto;
        return [normalizedMergedProductDto, comparePlainProductDto(normalizedTargetDto, normalizedMergedProductDto)];
    }

    async updateOnDemandFields(mergedProductDto: ProductDto, 
                         sourceProductDto: ProductDto, 
                         targetProductDto: ProductDto): Promise<[IDescriptionElement | undefined, IImagesElement | undefined, IParamElement[] | undefined]> {
        if (targetProductDto.stockSpriteParam === undefined) {
            mergedProductDto.stockSpriteParam = { description: undefined, images: undefined };
        }

        let descriptionElement = undefined;
        if (mergedProductDto.stockSpriteParam?.description === undefined || 
            mergedProductDto.stockSpriteParam?.description === false) {
                if (sourceProductDto.description !== undefined) {
                    mergedProductDto.description = sourceProductDto.description;
                    descriptionElement = this._setProductRequestBuilder.createDescriptionElement(sourceProductDto.description);
                    if (mergedProductDto.stockSpriteParam && descriptionElement) {
                        mergedProductDto.stockSpriteParam.description = true;
                    }
                }
        }

        let imagesElement = undefined;
        if (mergedProductDto.stockSpriteParam?.images === undefined || 
            mergedProductDto.stockSpriteParam?.images === false) {
                if (sourceProductDto.images !== undefined) {
                    mergedProductDto.images = sourceProductDto.images;
                    if (!mergedProductDto.sku) {
                        throw new Error("Product SKU is missing from mergedProductDto");
                    }
                    imagesElement = await this.createImagesElement(mergedProductDto.sku, sourceProductDto.images);
                    if (mergedProductDto.stockSpriteParam && imagesElement) {
                        mergedProductDto.stockSpriteParam.images = true;
                    }
                }
            }

        const paramElements = this.createParamElements(mergedProductDto.stockSpriteParam, targetProductDto.stockSpriteParam);
        return [descriptionElement, imagesElement, paramElements];
    }

    resetBufferedUpdateTimer(): void {
        if (this._updateBufferTimer) {
            clearTimeout(this._updateBufferTimer);
            this._updateBufferTimer = undefined;
        }
    }

    async sendBufferedUpdates(timeout = false): Promise<void> {
        // Send when buffer is full OR when called after timeout; otherwise do nothing.
        if (this._updateBuffer.length === 0 || (!timeout && this._updateBuffer.length < this._updateBufferSize)) {
            return;
        }

        if (timeout) {
            this._logger.info("Buffer timeout reached, sending remaining updates to Unas", { updates: this._updateBuffer.length });
        } else {
            this._logger.info("Update buffer size reached, sending updates to Unas", { updates: this._updateBuffer.length });
        }

        // Add products from the buffer to the request builder
        const bufferedProducts = this._updateBuffer.map((item) => item.productXml);

        // Create and send the update request
        const setProductRequest = this._setProductRequestBuilder.build(bufferedProducts);
        let updatedProducts;
        try {
            updatedProducts = await this.unasClient.setProduct(setProductRequest);
        } catch (error: unknown) {
            if (error instanceof AxiosError) {
                this._logger.error("Failed to update products via unas api", { error: Util.stringifyError((error.response as { data?: unknown } | undefined)?.data) });
            }
            else {
                this._logger.error("Failed to update products via unas api", { error: Util.stringifyError(error) });
            }
            this._updateBuffer = [];
            return;
        }

        // Update the cache of the changed products
        for (const updatedProduct of updatedProducts) {
            if (updatedProduct.Status === "ok") {
                const updateBufferItem = this._updateBuffer.find((p) => p.productXml.Sku === updatedProduct.Sku);
                
                if (updateBufferItem && updateBufferItem.productDto) {
                    if (!updateBufferItem.productDto.sku) {
                        throw new Error("Product SKU is missing from productDto");
                    }
                    await this._unasCacheRepository.add(updateBufferItem.productDto.sku, updateBufferItem.productDto);
                    this._logger.info("Product updated", { product: updatedProduct.Sku });
                } else {
                    this._logger.error("Updated product not found in update buffer", { product: updatedProduct.Sku });
                }
            }
            else {
                this._logger.error("Failed to update product", { product: updatedProduct.Sku, status: updatedProduct.Status });
            }
        }
        this._updateBuffer = [];
    }

    sendRemainingBufferedUpdatesAfterTimeout(): void {
        // Start the timer and after 10 seconds send the buffered updates anyway
        // so the updates are not stuck in the buffer if the buffer size is not reached.
        this._updateBufferTimer = setTimeout(() => {
            (async () => {
                await this.sendBufferedUpdates(true);
                clearTimeout(this._updateBufferTimer);
            })()
            .catch((error) => {
                this._logger.error("Error sending buffered updates on timeout", { error: stringify(error) });
            });
        }, 1000 * this._updateBufferTimeout);
    }

    async verifyImageUrl(imageDtos: ImageDto[]): Promise<boolean> {
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

    async createImagesElement(productSku: string, imageDtos: ImageDto[]): Promise<IImagesElement | undefined> {
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
            const imageElement = this._setProductRequestBuilder.createImageElement(unasImageType, index, image.uri, fileName, title, image.uri);
            imageElements.push(imageElement);
            index++;
        }

        if (imageDtos.length === 0) {
            return undefined;
        }

        const version = Util.getCurrentUtcDate();
        return this._setProductRequestBuilder.createImagesElement(defaultFileName, productSku, 1, version, imageElements);
    }

    createStockElements(mergedProductDto: ProductDto, differences: DtoDifference[]): IStockElement[] | undefined {
        const stockDiffs = differences.filter((d) => d.path[0] === "stocks").map((d) => ({ op: d.op, path: d.path }));
        if (!stockDiffs || !mergedProductDto.stocks || mergedProductDto.stocks.length === 0) {
            return undefined;
        }

        const stockDtos: StockDto[] = [];
        for (const stockDiff of stockDiffs) {
            if (stockDiff.op === "replace" || stockDiff.op === "add") {
                const stock = mergedProductDto.stocks[stockDiff.path[1] as number];
                stockDtos.push(stock);
            }
        }

        if (stockDtos.length === 0) {
            return undefined;
        }

        return this._setProductRequestBuilder.createStockElement(stockDtos);
    }

    createDataElements(mergedProductDto: ProductDto, differences: DtoDifference[]): IDataElement[] | undefined {
        const dataDiffs = differences.filter((d) => d.path[0] === "datas").map((d) => ({ op: d.op, path: d.path }));
        if (!dataDiffs || !mergedProductDto.datas || mergedProductDto.datas.length === 0) {
            return undefined;
        }

        const dataDtos: DataDto[] = [];
        for (const dataDiff of dataDiffs) {
            if (dataDiff.op === "replace" || dataDiff.op === "add") {
                const data = mergedProductDto.datas[dataDiff.path[0] as number];
                dataDtos.push(data);
            }
        }

        if (dataDtos.length === 0) {
            return undefined;
        }

        return this._setProductRequestBuilder.createDataElement(dataDtos);
    }

    createParamElements(mergedParamDto: StockSpriteParamDto | undefined, targetParamDto: StockSpriteParamDto | undefined): IParamElement[] | undefined {
        // Original (cached) flag states (true only if explicitly true)
        const originalDescription = targetParamDto?.description === true;
        const originalImages = targetParamDto?.images === true;

        // Compute next flags (only promote false/undefined -> true when element provided)
        let nextDescription = originalDescription;
        let nextImages = originalImages;

        if (mergedParamDto?.description && !originalDescription) {
            nextDescription = true;
        }
        if (mergedParamDto?.images && !originalImages) {
            nextImages = true;
        }

        const descriptionChanged = nextDescription !== originalDescription;
        const imagesChanged = nextImages !== originalImages;

        // Return only if at least one flag changed
        if (!descriptionChanged && !imagesChanged) {
            return undefined;
        }

        return [
            this._setProductRequestBuilder.createParamElement(
                nextDescription ? 1 : 0,
                nextImages ? 1 : 0
            )
        ];
    }
}
