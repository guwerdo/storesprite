import { inject, injectable } from "inversify";
import Redis from "ioredis";
import { Logger } from "log4js";
import { BindingKeys, ProcessedItemType } from "../types/index.js";
import { IRepository } from "./index.js";
import { RedisKeys } from "../redis/redis-keys.js";
import { Util } from "../utils/index.js";

@injectable()
export class ProcessedItemsRepository implements IRepository<string> {
    constructor(
        @inject(BindingKeys.Redis) private _redis: Redis.Redis,
        @inject(BindingKeys.Logger) private _logger: Logger,
    ) {}

    public get(_: string): Promise<string | undefined> {
        throw new Error("Not implemented");
    }

    public getAll(): Promise<string[] | undefined> {
        throw new Error("Not implemented");
    }

    public async add(key: string, value: string): Promise<void> {
        const fullKey = RedisKeys.processedItems(key as ProcessedItemType);
        try {
            await this._redis.sadd(fullKey, value);
            this._logger.info(`Item ${value} set as processed`);
        } catch (error: unknown) {
            if (error instanceof Error) {
                this._logger.error(`Error setting item '${fullKey}' as processed`, { error: Util.stringifyError(error) });
            } else {
                this._logger.error(`Error setting item '${fullKey}' as processed: Unknown error`);
            }
        }
    }

    public delete(_: string): Promise<void> {
        throw new Error("Not implemented");
    }

    public async exists(key: string, value: string): Promise<boolean> {
        const fullKey = RedisKeys.processedItems(key as ProcessedItemType);
        try {
            const result = await this._redis.sismember(fullKey, value);
            return result > 0;
        } catch (error: unknown) {
            if (error instanceof Error) {
                this._logger.error(`Error checking if item '${fullKey}' is processed`, { error: Util.stringifyError(error) });
            } else {
                this._logger.error(`Error checking if item '${fullKey}' is processed: Unknown error`);
            }
            return false;
        }
    }
}