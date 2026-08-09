import { Ajv, ValidateFunction } from "ajv";
import { AxiosResponse } from "axios";
import { Job, Worker } from "bullmq";
import csv from "csv-parser";
import stringify from "fast-json-stable-stringify";
import { Logger } from "log4js";
import { Readable } from "stream";
import stripBom from "strip-bom-stream";

import type { IConfiguration } from "./configuration/index.js";
import type { IBullMqConfiguration } from "./configuration/interfaces/bullmq-configuration.interface.js";
import { IAxiosHttpClient } from "./http-client/index.js";
import container from "./inversify.config.js";
import { stocksValid } from "./stocks-valid.js";
import { BindingKeys } from "./types/index.js";
import { IUnasDataSourceMapper } from "./unas/cache/index.js";
import { IUnasClient } from "./unas/client/index.js";
import { IProductDto } from "./unas/dto/interfaces/product-dto.interface.js";
import { AppFile } from "./utils/file-path-util.js";
import { Util } from "./utils/index.js";

const configuration = container.get<IConfiguration>(BindingKeys.IConfiguration);
const logger = container.get<Logger>(BindingKeys.Logger);
const ajv = container.get<Ajv>(BindingKeys.Ajv);
const productDtoSchema = Util.loadJsonSchema(Util.getAppFilePath(AppFile.PRODUCT_DTO_SCHEMA));
const validateJson: ValidateFunction<IProductDto> = ajv.compile<IProductDto>(productDtoSchema);
const httpClient = container.get<IAxiosHttpClient>(BindingKeys.IAxiosHttpClient);
const unasDataSourceMapper = container.get<IUnasDataSourceMapper>(BindingKeys.UnasDataSourceMapper);

// Get configuration sections
const bullMqConfiguration = configuration.getSection<IBullMqConfiguration>("bullMq");

if (!bullMqConfiguration) {
    throw new Error("Required configurations are missing");
}

let unasProductDtos: IProductDto[] | undefined;

async function handleJob(job: Job<unknown>): Promise<string> {
    const productDto: unknown = job.data;
    const isProductDto = (d: unknown): d is IProductDto => validateJson(d);

    if (isProductDto(productDto)) {
        if (unasProductDtos) {
            const unasProductDto = unasProductDtos.find((p) => p.sku === productDto.sku);
            if (unasProductDto) {
                logger.info(`Product with SKU ${productDto.sku} found in UNAS data source.`);
                const productStocks = productDto.stocks ?? [];
                const unasStocks = unasProductDto.stocks ?? [];
                if (stocksValid(productStocks, unasStocks)) {
                    // logger.info(`OK - Stocks match UNAS data source: ${productDto.sku} .`);
                } else {
                    logger.error(`ERROR - Stocks do NOT match UNAS data source: ${productDto.sku}`);
                }
            } else {
                logger.warn(`Product with SKU ${productDto.sku} not found in UNAS data source.`);
            }
        } else {
            logger.warn("UNAS product data is not loaded.");
        }

        return Promise.resolve("Job processed for product: " + productDto.sku);
    } else {
        return Promise.resolve("Error: job data is not a ProductDto");
    }
}

function handleJobCompletion(_: Job): void {
    // logger.info(`Job completed with result: ${job.returnvalue}`);
}

function handleJobFailure(job: Job | undefined, error: Error, _: string): void {
    if (job) {
        logger.error("Job failed with error", { error: stringify(error.message) });
    } else {
        logger.error("Job failed but no job details are available", { error: stringify(error.message) });
    }
}

async function loadUnasProducts(): Promise<IProductDto[] | undefined> {
    logger.info("Starting loading UNAS products.");
    try {
        const unasClient = container.get<IUnasClient>(BindingKeys.IUnasClient);
        const url = await unasClient.getProductDb();
        return await processData(url);
    } catch (error) {
        logger.error("Error", { error: Util.stringifyError(error) });
    }
}

async function processData(url: string): Promise<IProductDto[]> {
    try {
        const response: AxiosResponse<Readable> = await httpClient.instance.get(url, { responseType: "stream" });
        if (response.status !== 200) {
            throw new Error(`Failed to fetch product DB content. Status code: ${response.status}`);
        }

        const rowPromises: Promise<IProductDto>[] = [];
        const productDtos: IProductDto[] = [];

        await new Promise<void>((resolve, reject) => {
            response.data
                .pipe(stripBom())
                .pipe(
                    csv({
                        quote: '"',
                    }),
                )
                .on("data", (row: Record<string, unknown>) => {
                    const p = async (): Promise<IProductDto> => {
                        try {
                            const productDto = await handleStreamData(row);
                            logger.info(`Loading UNAS product SKU: ${productDto.sku}`);
                            productDtos.push(productDto);
                            return productDto;
                        } catch (error) {
                            logger.error("Error handling row.", { row: stringify(row), error: Util.stringifyError(error) });
                            process.exit(1);
                        }
                    };
                    rowPromises.push(p());
                })
                .on("error", (error: Error) => handleStreamError(error, reject))
                .on("end", () => void handleStreamEnd(resolve));
        });
        await Promise.all(rowPromises);
        return productDtos;
    } catch (error) {
        logger.error("Error fetching or parsing CSV", { error: Util.stringifyError(error) });
        throw error;
    }
}

async function handleStreamData(row: Record<string, unknown>): Promise<IProductDto> {
    const productDto: IProductDto = {
        sku: unasDataSourceMapper.mapSku(row),
        description: unasDataSourceMapper.mapDescription(row),
        images: undefined,
        stocks: await unasDataSourceMapper.mapStocks(row),
        datas: unasDataSourceMapper.mapDatas(row),
    };
    return productDto;
}

function handleStreamEnd(resolve: () => void): void {
    resolve();
}

function handleStreamError(error: Error, reject: (reason?: Error) => void): void {
    logger.error("An error occurred while reading the stream", { error: stringify(error.message) });
    reject(error);
}

async function main() {
    if (!bullMqConfiguration) {
        throw new Error("Required configurations are missing");
    }

    unasProductDtos = await loadUnasProducts();
    logger.info(`Loaded ${unasProductDtos?.length ?? 0} products from UNAS data source.`);
    logger.info(`Start listening to messages from the '${bullMqConfiguration.queue.parsed}' queue...`);
    const worker = new Worker<string>(bullMqConfiguration.queue.parsed, handleJob, bullMqConfiguration.worker);
    worker.on("completed", handleJobCompletion);
    worker.on("failed", handleJobFailure);
}

const isTestEnvironment = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.VITEST_WORKER_ID !== undefined;

if (!isTestEnvironment) {
    main().catch((error) => {
        logger.error("Unhandled error in main function", { error: Util.stringifyError(error) });
        process.exit(1);
    });
}

// Ensure the configuration uses live data:
//     TEST_MODE.UNAS.TEST_DATA = false
//     TEST_MODE.UNAS.CLIENT_MOCK = false
//     TEST_MODE.DATA_CONNECTOR_MOCK = false
// Connect to the `csv-provider` container and run `/usr/local/bin/run.sh` to fetch the latest Cromwell and MagicTools CSV files.
// Run `npm run cache:dev` to cache UNAS webshop data before `npm run sub:dev`.
// Run `npm run pub:dev` to publish data from MagicTools and Cromwell to the queue.
// Run `npm run sub:dev` to update the UNAS webshop with live queue data. Exit the script when done, as it runs continuously.
// Run `npm run pub:dev` again to publish data from MagicTools and Cromwell to the queue.
// Run `npm run validate:dev` to validate MagicTools and Cromwell data against UNAS webshop data. Exit the script when done, as it runs continuously.
// - This reads the queue again and downloads the UNAS webshop data for comparison.
// Check logged errors in the OpenSearch dashboard.

// TODO, create a script that clears the publuish queue and the cache
