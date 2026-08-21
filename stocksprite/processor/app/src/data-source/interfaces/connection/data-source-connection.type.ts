import { IDataSourceFileConnection } from "../connection/data-source-file-connection.interface.js";
import { IDataSourceHttpConnection } from "../connection/data-source-http-connection.interface.js";

export type IDataSourceConnection = IDataSourceFileConnection | IDataSourceHttpConnection;
