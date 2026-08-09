import { IDataSourceFileConnection } from "../connection/data-source-file-connection.interface.js";
import { IDataSourceHttpConnection } from "../connection/data-source-http-connection.interface.js";
import { IDataSourceSftpConnection } from "../connection/data-source-sftp-connection.interface.js";

export type IDataSourceConnection = IDataSourceFileConnection | IDataSourceHttpConnection | IDataSourceSftpConnection;
