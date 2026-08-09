import { inject, injectable } from "inversify";
import { RedisKeys } from "../redis/index.js";
import Redis from "ioredis";
import type { Logger } from "log4js";
import { BindingKeys } from "../types/index.js";
import { IRepository } from "./interfaces/index.js";
import { Util } from "../utils/index.js";

@injectable()
export class ValidatedUrlsRepository implements IRepository<string> {
    constructor(
        @inject(BindingKeys.Redis) private _redis: Redis.Redis,
        @inject(BindingKeys.Logger) private _logger: Logger,
    ) {}

    public get(_: string): Promise<string | undefined> {
        throw new Error("Method not implemented.");
    }

    public getAll(): Promise<string[] | undefined> {
        throw new Error("Not implemented");
    }

    public async add(_: string, value: string): Promise<void> {
        try {
            await this._redis.sadd(RedisKeys.validatedUrls, value);
        } catch (error: unknown) {
            if (error instanceof Error) {
                this._logger.error(`Error adding URL to validated URLs`, { url: value, error: Util.stringifyError(error) });
            } else {
                this._logger.error(`Error adding URL to validated URLs: Unknown error`, { url: value });
            }
        }
    }

    public delete(_: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async exists(_: string, value: string): Promise<boolean> {
        return (await this._redis.sismember(RedisKeys.validatedUrls, value)) === 1;
    }
}