export interface ISftpConnection {
    host: string;
    port: number;
    username: string;
    privateKey: Buffer;
    debug: (message: string) => void;
}
