import { Ajv, ValidateFunction } from "ajv";
import { Job, Worker } from "bullmq";
import stringify from "fast-json-stable-stringify";
import { Logger } from "log4js";

import type { IConfiguration } from "./configuration/index.js";
import type { IBullMqConfiguration } from "./configuration/interfaces/bullmq-configuration.interface.js";
import container from "./inversify.config.js";
import { BindingKeys } from "./types/index.js";
import { IProductDto } from "./unas/dto/interfaces/index.js";
import { IUnasTranslator } from "./unas/updater/index.js";
import { AppFile } from "./utils/file-path-util.js";
import { Util } from "./utils/index.js";

const config = container.get<IConfiguration>(BindingKeys.IConfiguration);
const unasTranslator = container.get<IUnasTranslator>(BindingKeys.IUnasTranslator);
const logger = container.get<Logger>(BindingKeys.Logger);
const ajv = container.get<Ajv>(BindingKeys.Ajv);
const productDtoSchema = Util.loadJsonSchema(Util.getAppFilePath(AppFile.PRODUCT_DTO_SCHEMA));
const validateJson: ValidateFunction<IProductDto> = ajv.compile<IProductDto>(productDtoSchema);

// Get configuration sections
const bullMqConfiguration = config.getSection<IBullMqConfiguration>("bullMq");

if (!bullMqConfiguration) {
    throw new Error("Required configuration sections are missing");
}

async function handleJob(job: Job<unknown>): Promise<string> {
    const productDto: unknown = job.data;
    const isProductDto = (d: unknown): d is IProductDto => validateJson(d);

    if (isProductDto(productDto)) {
        await unasTranslator.translate(productDto);
        return "Job processed for product: " + productDto.sku;
    } else {
        const errors = validateJson.errors ? stringify(validateJson.errors) : "unknown error";
        logger.error(`Validation failed for job data in translate phase: ${errors}`, { jobData: stringify(productDto) });
        throw new Error(`Job data is not a valid ProductDto. Errors: ${errors}`);
    }
}

function handleJobCompletion(_: Job): void {
    // logger.info(`Job completed with result: ${job.returnvalue}`);
}

function handleJobFailure(job: Job | undefined, error: Error, _: string): void {
    if (job) {
        logger.error("Job failed with error", { job: stringify(job.data), error: stringify(error.message) });
    } else {
        logger.error("Job failed but no job details are available", { error: stringify(error.message) });
    }
}

function main() {
    logger.info(`Curent environment: ${Util.getCurrentEnvironment()}`);

    const queueName = bullMqConfiguration?.queue.parsed;
    if (!queueName) {
        throw new Error("Queue name is not configured");
    }

    logger.info(`Start listening to messages from the '${queueName}' queue...`);
    const worker = new Worker<string>(queueName, handleJob, bullMqConfiguration.worker);
    worker.on("completed", handleJobCompletion);
    worker.on("failed", handleJobFailure);
}

main();
