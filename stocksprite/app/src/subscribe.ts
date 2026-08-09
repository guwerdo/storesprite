import { Ajv, ValidateFunction } from "ajv";
import { Job, Worker } from "bullmq";
import stringify from "fast-json-stable-stringify";
import { Logger } from "log4js";

import { queueName, workerConfig } from "./config/config.js";
import container from "./inversify.config.js";
import { BindingKeys } from "./types/index.js";
import { ProductDto } from "./unas/dto/product-dto.interface.js";
import { IUnasUpdater } from "./unas/updater/index.js";
import { AppFile } from "./utils/file-path-util.js";
import { Util } from "./utils/index.js";

const unasUpdater = container.get<IUnasUpdater>(BindingKeys.IUnasUpdater);
const logger = container.get<Logger>(BindingKeys.Logger);
const ajv = container.get<Ajv>(BindingKeys.Ajv);
const productDtoSchema = Util.loadJsonSchema(Util.getAppFilePath(AppFile.PRODUCT_DTO_SCHEMA));
const validateJson: ValidateFunction<ProductDto> = ajv.compile<ProductDto>(productDtoSchema);

async function handleJob(job: Job<unknown>): Promise<string> {
    const productDto: unknown = job.data;
    const isProductDto = (d: unknown): d is ProductDto => validateJson(d);

    if (isProductDto(productDto)) {
        await unasUpdater.update(productDto);
        return "Job processed for product: " + productDto.sku;
    } else {
        return "Error: job data is not a ProductDto";
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

function main() {
    logger.info(`Start listening to messages from the '${queueName.main}' queue...`);
    const worker = new Worker<string>(queueName.main, handleJob, workerConfig);
    worker.on("completed", handleJobCompletion);
    worker.on("failed", handleJobFailure);
}

main();
