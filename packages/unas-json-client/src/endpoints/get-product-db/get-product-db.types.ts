export interface IGetProductDBRequest {
    format?: "csv" | "json" | "xls" | "xml"; // default "csv"
    getParam?: boolean; // default true
    getStock?: boolean; // default true
    getData?: boolean; // default true
}
