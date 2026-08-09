export interface ILog4jsConfig {
    appenders: {
        dailyLogs: {
            type: string;
            filename: string;
            pattern: string;
            keepFileExt: boolean;
            compress: boolean;
            numBackups: number;
            layout: {
                type: string;
                pattern: string;
            };
        };
        console: {
            type: string;
            layout: {
                type: string;
                pattern: string;
            };
        };
    };
    categories: {
        default: {
            appenders: string[];
            level: string;
        };
        cache: {
            appenders: string[];
            level: string;
        };
        publish: {
            appenders: string[];
            level: string;
        };
        subscribe: {
            appenders: string[];
            level: string;
        };
    };
}
