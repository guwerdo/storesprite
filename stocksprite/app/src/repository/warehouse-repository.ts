import { inject, injectable } from "inversify";
import { WarehouseDto } from "../unas/dto/warehouse-dto.interface.js";
import { IRepository } from "./index.js";
import { BindingKeys } from "../types/index.js";
import { Logger } from "log4js";
import Redis from "ioredis";
import { RedisKeys } from "../redis/redis-keys.js";
import { Util } from "../utils/index.js";

@injectable()
export class WarehouseRepository implements IRepository<WarehouseDto> {
    constructor(
        @inject(BindingKeys.Redis) private _redis: Redis.Redis,
        @inject(BindingKeys.Logger) private _logger: Logger,
    ) {}

    public async get(key: string): Promise<WarehouseDto | undefined> {
        const fullKey = RedisKeys.warehouse(key);
        return this.getByFullKey(fullKey);
    }

    public async getAll(): Promise<WarehouseDto[] | undefined> {
        let cursor = "0";
        const warehouses: WarehouseDto[] = [];
        const pattern = RedisKeys.warehouse("*");

        do {
            const [nextCursor, keys] = await this._redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
            cursor = nextCursor;

            if (keys.length > 0) {
                const items = await Promise.all(keys.map((key) => this.getByFullKey(key)));
                warehouses.push(...(items.filter((item): item is WarehouseDto => item !== null)));
            }
        } while (cursor !== "0");
        return warehouses;
    }

    public async add(key: string, value: WarehouseDto): Promise<void> {
        const fullkey = RedisKeys.warehouse(key);
        await this._redis.hset(fullkey, value);
    }

    public async delete(key: string): Promise<void> {
        const fullkey = RedisKeys.warehouse(key);
        await this._redis.del(fullkey);
    }

    public exists(_1: string, _2: string): Promise<boolean> {
        throw new Error("Not implemented");
    }

    private async getByFullKey(key: string): Promise<WarehouseDto | undefined> {
        const warehouse = await this._redis.hgetall(key);
        if (warehouse && Object.keys(warehouse).length > 0) {
            const result: WarehouseDto = {
                Id: Util.mapping.getNumberValue(warehouse.Id as unknown),
                Name: warehouse.Name,
                PublicName: warehouse.PublicName,
            };
            return result;
        }
        return undefined;
    }
}