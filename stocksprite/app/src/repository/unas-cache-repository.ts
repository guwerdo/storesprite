import { inject, injectable } from "inversify";
import { RedisKeys } from "../redis/redis-keys.js";
import Redis from "ioredis";
import { Logger } from "log4js";
import { BindingKeys } from "../types/index.js";
import { ICacheRepository } from "./index.js";
import { ProductDto } from "../unas/dto/index.js";
import { Ajv, ValidateFunction } from "ajv";
import { Util } from "../utils/index.js";
import { AppFile } from "../utils/file-path-util.js";
import stringify from "fast-json-stable-stringify";

@injectable()
export class UnasCacheRepository implements ICacheRepository<ProductDto> {
    private readonly validateProductDto: ValidateFunction<ProductDto>;

    constructor(
        @inject(BindingKeys.Redis) private _redis: Redis.Redis,
        @inject(BindingKeys.Logger) private _logger: Logger,
        @inject(BindingKeys.Ajv) private _ajv: Ajv
    ) {
        const productDtoSchema = Util.loadJsonSchema(Util.getAppFilePath(AppFile.PRODUCT_DTO_SCHEMA));
        this.validateProductDto = this._ajv.compile<ProductDto>(productDtoSchema);
    }

    public async get(key: string): Promise<ProductDto | undefined> {
        const fullKey = RedisKeys.unasCache(key);
        return await this.getByFullKey(fullKey);
    }

    public getAll(): Promise<ProductDto[] | undefined> {
        throw new Error("Not implemented");
    }

    public async add(key: string, value: ProductDto): Promise<void> {
        const fullkey = RedisKeys.unasCache(key);
        await this._redis.call("JSON.SET", fullkey, "$", stringify(value));
        // Delete product key from the invalidates set when added to the cache
        await this._redis.srem(RedisKeys.unasCacheInvalidated, fullkey);
    }

    public async delete(key: string): Promise<void> {
        const fullKey = RedisKeys.unasCache(key);
        const exists = await this._redis.exists(fullKey);
        if (exists) {
            await this._redis.del(fullKey);
        }
    }

    public exists(_1: string, _2: string): Promise<boolean> {
        throw new Error("Not implemented");
    }

    public async invalidateAll(): Promise<void> {
        // Clear previous invalidation hash
        await this._redis.del(RedisKeys.unasCacheInvalidated);

        const pattern = RedisKeys.unasCache("*");
        const hashKey = RedisKeys.unasCacheInvalidated;

        // Use SCAN instead of KEYS to avoid blocking Redis when there are many keys
        let cursor = "0";
        const BATCH_SIZE = 100;

        do {
            const [nextCursor, keys] = await this._redis.scan(cursor, "MATCH", pattern, "COUNT", BATCH_SIZE);
            if (keys.length > 0) {
                await this._redis.sadd(hashKey, keys);
            }
            cursor = nextCursor;
        } while (cursor !== "0");
    }

    public async removeInvalidated(): Promise<number> {
        // Process remaining invalidated cache keys in batches without blocking Redis.
        // Any key still present in the set represents a cache entry never refreshed.
        const setKey = RedisKeys.unasCacheInvalidated;
        const BATCH_SIZE = 500; // Tune as needed
        let removed = 0;

        while (true) {
            // SPOP with count streams and shrinks the set atomically.
            const batch = await this._redis.spop(setKey, BATCH_SIZE) as string[] | null;
            if (!batch || batch.length === 0) break;

            // Pipeline deletions; DEL is fine for small JSON values. Use UNLINK if large values & Redis >=4.
            const pipeline = this._redis.pipeline();
            for (const key of batch) {
                pipeline.del(key);
            }
            const results = await pipeline.exec();

            if (results) {
                for (const [err, res] of results) {
                    if (!err && typeof res === "number" && res > 0) {
                        removed += res; // res is 1 if key deleted, 0 if missing
                    }
                }
            }
        }

        return removed;
    }

    private async getByFullKey(key: string): Promise<ProductDto | undefined> {
        try {
            const raw = await this._redis.call("JSON.GET", key) as string;
            if (!raw) return undefined;

            const productDto: unknown = JSON.parse(raw);
            // Runtime type validation of raw productDto against the schema
            if (this.validateProductDto(productDto)) { // TypeScript 'type predicate'
                // inside here, TypeScript knows productDto is type of ProductDto
                return productDto;
            }

            this._logger.error("Invalid ProductDto in cache", { key: key, errors: this.validateProductDto.errors });
            return undefined;
        } catch (err) {
            this._logger.error("Failed to deserialize ProductDto", err);
            return undefined;
        }
    }
}