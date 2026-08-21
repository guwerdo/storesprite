import { AxiosResponse } from "axios";
import csv from "csv-parser";
import stringify from "fast-json-stable-stringify";
import Redis from "ioredis";
import { Logger } from "log4js";
import log4js from "log4js";
import { exit } from "process";
import { Readable } from "stream";
import stripBom from "strip-bom-stream";

import { IAxiosHttpClient } from "./http-client/interfaces/http-client.interface.js";
import container from "./inversify.config.js";
import { ICacheRepository } from "./repository/interfaces/index.js";
import { IRepository } from "./repository/interfaces/repository.interface.js";
import { BindingKeys } from "./types/index.js";
import { IUnasDataSourceMapper } from "./unas/cache/index.js";
import { IUnasClient } from "./unas/client/index.js";
import { IProductDto } from "./unas/dto/interfaces/index.js";
import { comparePlainProductDto } from "./unas/dto/product-dto-helper.js";
import { WarehouseDto } from "./unas/dto/warehouse-dto.interface.js";
import { Util } from "./utils/index.js";

const logger = container.get<Logger>(BindingKeys.Logger);
const redis = container.get<Redis.Redis>(BindingKeys.Redis);
const httpClient = container.get<IAxiosHttpClient>(BindingKeys.IAxiosHttpClient);
const unasCacheRepository = container.get<ICacheRepository<IProductDto>>(BindingKeys.UnasCacheRepository);
const unasDataSourceMapper = container.get<IUnasDataSourceMapper>(BindingKeys.UnasDataSourceMapper);

let updatedItems = 0;
let addedItems = 0;
let removedItems = 0;

async function processData(url: string): Promise<void> {
    try {
        const response: AxiosResponse<Readable> = await httpClient.instance.get(url, { responseType: "stream" });
        if (response.status !== 200) {
            throw new Error(`Failed to fetch product DB content. Status code: ${response.status}`);
        }

        const rowPromises: Promise<void>[] = [];

        await new Promise<void>((resolve, reject) => {
            response.data
                .pipe(stripBom())
                .pipe(
                    csv({
                        quote: '"',
                    }),
                )
                .on("data", (row: Record<string, unknown>) => {
                    const p = handleStreamData(row).catch((error) => {
                        logger.error("Error handling row.", { row: stringify(row), error: Util.stringifyError(error) });
                        process.exit(1);
                    });
                    rowPromises.push(p);
                })
                .on("error", (error: Error) => handleStreamError(error, reject))
                .on("end", () => void handleStreamEnd(resolve));
        });
        await Promise.all(rowPromises);
    } catch (error) {
        logger.error("Error fetching or parsing CSV", { error: Util.stringifyError(error) });
        throw error;
    }
}

async function handleStreamData(row: Record<string, unknown>): Promise<void> {
    const productDto: IProductDto = {
        sku: unasDataSourceMapper.mapSku(row),
        description: unasDataSourceMapper.mapDescription(row),
        images: undefined,
        stocks: await unasDataSourceMapper.mapStocks(row),
        datas: unasDataSourceMapper.mapDatas(row),
    };
    await saveProduct(productDto);
}

function handleStreamEnd(resolve: () => void): void {
    resolve();
}

function handleStreamError(error: Error, reject: (reason?: Error) => void): void {
    logger.error("An error occurred while reading the stream", { error: stringify(error.message) });
    reject(error);
}

async function saveProduct(productDto: IProductDto): Promise<void> {
    try {
        if (!productDto.sku) {
            throw new Error("Product SKU is missing from productDto");
        }

        const cachedProductDto = await unasCacheRepository.get(productDto.sku);
        if (cachedProductDto) {
            const plainJsProductDto = JSON.parse(stringify(productDto)) as IProductDto;
            const differences = comparePlainProductDto(cachedProductDto, plainJsProductDto);
            if (differences.length) {
                logger.info("Item updated in cache", { sku: productDto.sku, updatedFields: stringify(differences) });
                updatedItems++;
            }
        } else {
            logger.info("Item added to cache", { sku: productDto.sku });
            addedItems++;
        }
        await unasCacheRepository.add(productDto.sku, productDto);
    } catch (error) {
        logger.error("Error caching data", { error: Util.stringifyError(error) });
    }
}

async function loadWarehouses(): Promise<void> {
    const unasClient = container.get<IUnasClient>(BindingKeys.IUnasClient);
    const warehouseRepository = container.get<IRepository<WarehouseDto>>(BindingKeys.WarehouseRepository);

    const warehouses = await unasClient.getWarehouse();
    for (const warehouse of warehouses) {
        await warehouseRepository.add(warehouse.Id.toString(), {
            Id: warehouse.Id,
            Name: warehouse.Name,
            PublicName: warehouse.PublicName,
        } as WarehouseDto);
    }
}

async function main() {
    logger.info(`Curent environment: ${Util.getCurrentEnvironment()}`);
    logger.info("Starting cache update process.");

    try {
        const unasClient = container.get<IUnasClient>(BindingKeys.IUnasClient);
        await loadWarehouses();
        const url = await unasClient.getProductDb();
        await unasCacheRepository.invalidateAll();
        await processData(url);
        removedItems = await unasCacheRepository.removeInvalidated();
        console.log("UNAS data source: " + url);
    } catch (error) {
        logger.error("Error", { error: Util.stringifyError(error) });
    } finally {
        logger.info("Cache update finished", { added: addedItems, updated: updatedItems, removed: removedItems });
        await redis.quit();
        log4js.shutdown(() => {
            exit(0); // Exit the process after logs are flushed
        });
    }
}

main().catch(console.error);
