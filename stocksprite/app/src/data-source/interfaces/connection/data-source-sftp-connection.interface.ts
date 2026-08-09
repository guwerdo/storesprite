export interface IDataSourceSftpConnection {
    protocol: "sftp";
    testData?: string;
    host: string;
    port: number;
    username: string;
    password: string;
    privateKey: string;
    remotePath: string;
}
