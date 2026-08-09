import { IDataSourceFieldMapping } from "./data-source-field-mapping.interface.js";

export interface IDataSourceDataMapping {
    id: number;
    name: string;
    mapping: IDataSourceFieldMapping;
}
