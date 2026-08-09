export interface ILog4jsConfiguration {
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
        parse: {
            appenders: string[];
            level: string;
        };
        translate: {
            appenders: string[];
            level: string;
        };
        send: {
            appenders: string[];
            level: string;
        };
    };
}
