import { AxiosError } from "axios";
import { Job, Worker } from "bullmq";
import { Logger } from "log4js";

import type { IConfiguration } from "./configuration/index.js";
import type { IBullMqConfiguration } from "./configuration/interfaces/bullmq-configuration.interface.js";
import container from "./inversify.config.js";
import { BindingKeys } from "./types/index.js";
import { IUnasClient } from "./unas/client/interfaces/unas-client.interface.js";
import { IProductElement } from "./unas/client/request/builder/interfaces/product-element.interface.js";
import { createSetProductRequestXml } from "./unas/client/request/builder/set-product-request-builder.js";
import type { IProductDto } from "./unas/dto/interfaces/index.js";
import { Util } from "./utils/index.js";

const config = container.get<IConfiguration>(BindingKeys.IConfiguration);
const unasClient = container.get<IUnasClient>(BindingKeys.IUnasClient);
const logger = container.get<Logger>(BindingKeys.Logger);

// Get configuration sections
const bullMqConfiguration = config.getSection<IBullMqConfiguration>("bullMq");

if (!bullMqConfiguration) {
    throw new Error("Required configuration sections are missing");
}

interface TranslatedJobData {
    productXml: IProductElement;
    productDto?: IProductDto;
}

interface JobBatchItem {
    job: Job<TranslatedJobData>;
    resolve: (value: Awaited<ReturnType<IUnasClient["setProduct"]>> | string) => void;
    reject: (err: unknown) => void;
}

class JobBatcher {
    private batch: JobBatchItem[] = [];
    private timeout: NodeJS.Timeout | null = null;
    private maxBatchSize = 100;
    private lingerMs = 60_000;

    constructor(
        private unasClient: IUnasClient,
        private logger: Logger,
    ) {}

    add(job: Job<TranslatedJobData>): Promise<Awaited<ReturnType<IUnasClient["setProduct"]>> | string> {
        return new Promise((resolve, reject) => {
            this.batch.push({ job, resolve, reject });

            if (this.batch.length >= this.maxBatchSize) {
                void this.flush("maxBatchSize");
            } else {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                }
                this.timeout = setTimeout(() => void this.flush("timeout"), this.lingerMs);
            }
        });
    }

    private async flush(reason: "timeout" | "maxBatchSize") {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        const currentBatch = this.batch;
        this.batch = [];

        if (currentBatch.length === 0) return;

        if (reason === "timeout") {
            this.logger.info(`Flushing batch after ${this.lingerMs}ms of inactivity.`);
        }

        this.logger.info(
            `Creating product update XML from ${currentBatch.length} update jobs into a single UNAS API request payload and sending it as one batch.`,
        );

        const productXmlElements: IProductElement[] = [];
        for (const item of currentBatch) {
            const data = item.job.data;
            if (data && data.productXml) {
                productXmlElements.push(data.productXml);
            }
        }

        if (productXmlElements.length === 0) {
            for (const item of currentBatch) {
                item.resolve("No XML data to send");
            }
            return;
        }

        const setProductRequestXml = createSetProductRequestXml(productXmlElements);
        try {
            const response = await this.unasClient.setProduct(setProductRequestXml);
            this.logger.info(`Successfully sent batch of ${productXmlElements.length} updates to UNAS API.`);
            for (const item of currentBatch) {
                item.resolve(response);
            }
        } catch (error: unknown) {
            if (error instanceof AxiosError) {
                this.logger.error("Failed to update products via UNAS API (Axios error)", {
                    error: Util.stringifyError(error.response?.data || error.message),
                });
            } else {
                this.logger.error("Failed to update products via UNAS API", {
                    error: Util.stringifyError(error),
                });
            }
            for (const item of currentBatch) {
                item.reject(error);
            }
        }
    }
}

const batcher = new JobBatcher(unasClient, logger);

async function handleJob(job: Job<TranslatedJobData>): Promise<Awaited<ReturnType<IUnasClient["setProduct"]>> | string> {
    return batcher.add(job);
}

function handleJobCompletion(job: Job<TranslatedJobData>): void {
    logger.info(`Job completed: ${job.id} (Product: ${job.data?.productDto?.sku})`);
}

function handleJobFailure(job: Job<TranslatedJobData> | undefined, error: Error): void {
    if (job) {
        logger.error(`Job failed: ${job.id} (Product: ${job.data?.productDto?.sku})`, {
            error: error.message,
        });
    } else {
        logger.error("Job failed, but no job details are available", {
            error: error.message,
        });
    }
}

function main() {
    logger.info(`Curent environment: ${Util.getCurrentEnvironment()}`);

    const queueName = bullMqConfiguration?.queue.translated;
    if (!queueName) {
        throw new Error("Translated queue name is not configured");
    }

    logger.info(`Start listening to messages from the '${queueName}' queue...`);
    const worker = new Worker(queueName, handleJob, {
        ...bullMqConfiguration.worker,
        concurrency: 100,
    });
    worker.on("completed", handleJobCompletion);
    worker.on("failed", handleJobFailure);
}

main();
