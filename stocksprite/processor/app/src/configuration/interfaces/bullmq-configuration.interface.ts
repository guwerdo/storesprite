export interface IBullMqConfiguration {
    queue: {
        parsed: string;
        translated: string;
    };
    worker: {
        connection: {
            host: string;
            port: number;
        };
        removeOnComplete: {
            age: number;
            count: number;
        };
        removeOnFail: {
            count: number;
        };
    };
}
