export interface IDataSourceHttpConnection {
    protocol: "http";
    testData?: string;
    host: string;
    port?: number;
    path: string;
    query?: string;
    username?: string;
    password?: string;
}
