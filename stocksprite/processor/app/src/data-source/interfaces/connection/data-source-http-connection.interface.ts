export interface IDataSourceHttpConnection {
    protocol: "http";
    host: string;
    port?: number;
    path: string;
    query?: string;
    username?: string;
    password?: string;
}
