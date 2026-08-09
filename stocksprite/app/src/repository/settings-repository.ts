import Redis from "ioredis";
import { inject, injectable } from "inversify";
import { RedisKeys } from "../redis/redis-keys.js";
import { BindingKeys } from "../types/index.js";
import { IRepository } from "./index.js";

@injectable()
export class SettingsRepository implements IRepository<string> {
    constructor(@inject(BindingKeys.Redis) private _redis: Redis.Redis) {}

    public async get(key: string): Promise<string | undefined> {
        const fullKey = RedisKeys.settings(key);
        const result = await this._redis.get(fullKey);
        return result ?? undefined;
    }

    public getAll(): Promise<string[] | undefined> {
        throw new Error("Not implemented");
    }

    public async add(key: string, value: string): Promise<void> {
        const fullKey = RedisKeys.settings(key);
        await this._redis.set(fullKey, value);
    }

    public delete(_: string): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public exists(_1: string, _2: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}