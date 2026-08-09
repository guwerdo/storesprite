# Stocksprite

StockSprite is a lightweight automation service that silently updates your Unas-powered webshop once a day. It synchronizes product descriptions, images, and stock counts—ensuring your catalog stays fresh and accurate without manual work.
Powered by Node.js, TypeScript, and Docker, StockSprite runs efficiently in the background like a quiet digital assistant—working while you don’t have to.

# Notes

## How to start Redis insight container

- Install container: `docker run -d --network=stocksprite_default --name redisinsight -p 5540:5540 redis/redisinsight:latest`
- Add the local redis database to the web admin page. Database url: `redis:6379`

## Misc

// docker run -d --network=stocksprite_default --name redisinsight -p 5540:5540 redis/redisinsight:latest
// https://google.github.io/styleguide/tsguide.html#identifiers-imports
// https://gist.github.com/anichitiandreea/e1d466022d772ea22db56399a7af576b#naming
// https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-cdk-typescript-iac/typescript-best-practices.html

Use camelCase for variable and function names.
Use PascalCase for class names and interface names.
Use camelCase for interface members.
Use PascalCase for type names and enum names.
Name files with camelCase (for example, ebsVolumes.tsx or storage.tsb)

Select NAN stockHu items:
EVAL " local result = {} local cursor = '0' repeat local scan = redis.call('SCAN', cursor, 'MATCH', 'unas:cache:\*', 'COUNT', 100) cursor = scan[1] local keys = scan[2] for i, key in ipairs(keys) do local value = redis.call('HGET', key, 'stockHu') local num = tonumber(value) if num and num == num then -- checks for number and not NaN table.insert(result, key) end end until cursor == '0' return result " 0

REASDME

testing
How to debug ssh2-sftp-client connections with ICromwellSftpConfig

```
    debug: (message: string) => {
        console.log(`SFTP Debug: ${message}`);
    },
```

- When creating unas product xml always validate in code that values from stock databases are within the range of acceptable unas values (stock not negative number, etc...)
- How to upload test data to unas with postman
- How to hanle images, image upload unas restrictions. link unas page about this
- How to use DataProviderMock
- Run cache command first before setting up everything
- Describe what does cach, pub, and sub do exactly
- Save postman files to batch create test data
- the unas param name `stocksprite-param` in code also needs to be added in unas webshop admin: Unas -> Beallitasok -> Termek beallitasok -> Termek parameterek: 'Szabad szavas', 'A termék adatbázis exportban szerepeljen', 'Export feedekben szerepeljen', 'Termék oldalon megjelenhet: nem'
- Document app lifecycle:
    - run `cache` once a week,
    - run `pub` daily,
    - `sub` service should run all the time
- How to reset log data
    - delete `opensearch` volumes
    - delete `fluentbit` volumes
    - delete cookies, session, local storage from `opensearch dashboard` web app
- when changing interfaces in `data-source` folder, regenerate the schema file described in `data-source/readme.md`, then validate the `data-source.json` file with `npm run datasrc:validate`.

## Redis and Redis Insight app

RedisInsight uses the Redis SCAN command behind the scenes to find keys. returns partial results on each call. Doesn’t guarantee full coverage in one scan — so not all matching keys are returned right away. RedisInsight gives you a "Scan More" button — it lets you continue scanning the keyspace without freezing the server or overwhelming memory.

- In RedisInsight, click "Scan More" multiple times to let it continue finding matches.
- Use a Redis Workbench in the app for quick debugging. Run: `KEYS 'stocksprite:processed-items:*'`

## Inversify concepts

`container.bind<IUnasCache>("IUnasCache").to(UnasCache);`

`"IUnasCache"`
This is the runtime key used by the Inversify container — think of it as a unique ID in a registry.
It helps Inversify look up the bound class when someone later requests "IUnasCache".

`<IUnasCache>`
This is a TypeScript-only generic, used at compile time to indicate the expected type of the resolved object.
It does not exist at runtime — it's purely for static type checking.

`.to(UnasCache)`
This tells Inversify: When "IUnasCache" is requested, instantiate UnasCache and return it.
UnasCache must implement or fulfill the contract of IUnasCache.
