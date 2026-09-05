import {
  ConnectionConfig,
  DataFormatConfig,
  ConnectionCredentials,
  ConnectionTestResult,
} from "./stocksprite/DataConnectionRepository.interface.js";
import { StockMappingItem, MappingRule, MappingSchedule } from "./stocksprite/MappingRepository.interface.js";
import { SkuNormalizations } from "./stocksprite/MappingHistoryRepository.interface.js";
import { DataConnectionChannel, DataConnectionFormat } from "../entities/stocksprite/DataConnection.js";

export interface IJsonSchemaValidator {
  validateConfig(channel: DataConnectionChannel, config: unknown): ConnectionConfig;
  validateDataFormatConfig(format: DataConnectionFormat, dataFormatConfig: unknown): DataFormatConfig;
  validateCredentials(channel: DataConnectionChannel, credentials: unknown): ConnectionCredentials | null;
  validateTestResult(testResult: unknown): ConnectionTestResult;
  validateStockMappings(items: unknown): StockMappingItem[];
  validateMappingRules(rules: unknown): MappingRule[];
  validateSchedule(schedule: unknown): MappingSchedule;
  validateSkuNormalizations(skuNormalizations: unknown): SkuNormalizations;
}
