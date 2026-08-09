export const RedisKeys = {
    unasCache: (id: string) => `stocksprite:cache:unas:${id}`,
    unasCacheInvalidated: "stocksprite:cache:unas:invalidated",
    settings: (key: string) => `stocksprite:settings:${key}`,
    validatedUrls: "stocksprite:cache:validated-urls",
    warehouse: (id: string) => `stocksprite:warehouse:${id}`,
};
