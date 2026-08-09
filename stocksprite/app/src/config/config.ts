import { ILog4jsConfig, IRedisConfig as RedisConfigOptions } from "./index.js";

const redisConfig: RedisConfigOptions = {
    connection: {
        host: "redis-stack", // Redis container name from docker-compose.yml
        port: 6379,
    },
};

const log4jsConfig: ILog4jsConfig = {
    appenders: {
        dailyLogs: {
            type: "dateFile",
            filename: "logs/app.log",
            pattern: "yyyy-MM",
            keepFileExt: true,
            compress: false,
            numBackups: 6, // Keep logs for the last 7 days
            layout: {
                type: "json-with-data-field",
                pattern: "",
            },
        },
        console: {
            type: "stdout",
            layout: {
                type: "json-with-data-field",
                pattern: "",
            },
        },
    },
    categories: {
        default: { appenders: ["dailyLogs", "console"], level: "info" },
        cache: { appenders: ["dailyLogs", "console"], level: "info" },
        publish: { appenders: ["dailyLogs", "console"], level: "info" },
        subscribe: { appenders: ["dailyLogs", "console"], level: "info" },
    },
};

const queueName = {
    main: "main",
};

const workerConfig = {
    connection: redisConfig.connection,
    removeOnComplete: {
        age: 3600,
        count: 1000,
    },
    removeOnFail: { count: 100 },
};

const TEST_MODE = {
    UNAS: {
        TEST_DATA: true, // If true, Unas test data will be used from 'test-csv-server' container
        TEST_DATA_URL: "http://test-csv-server/unas-ezermesterszerszam.csv",
        CLIENT_MOCK: true, // If true no data will be sent to Unas webshop otherwise data will be sent to Unas directly.
    },
    // If true data comes from 'connection.testData' property of '/app/data-source/data-source.json' file otherwise it reads from a real datasource.
    DATA_CONNECTOR_MOCK: true,
};

export { redisConfig, log4jsConfig, queueName, workerConfig, TEST_MODE };
