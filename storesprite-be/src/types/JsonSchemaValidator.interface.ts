import {
  ConnectionConfig,
  DataFormatConfig,
  ConnectionCredentials,
  ConnectionTestResult,
} from "./DataConnectionRepository.interface.js";
import { StockMappingItem, MappingRule } from "./MappingRepository.interface.js";
import { DataConnectionChannel, DataConnectionFormat } from "../entities/DataConnection.js";

export interface IJsonSchemaValidator {
  validateConfig(channel: DataConnectionChannel, config: unknown): ConnectionConfig;
  validateDataFormatConfig(format: DataConnectionFormat, dataFormatConfig: unknown): DataFormatConfig;
  validateCredentials(channel: DataConnectionChannel, credentials: unknown): ConnectionCredentials | null;
  validateTestResult(testResult: unknown): ConnectionTestResult;
  validateStockMappings(items: unknown): StockMappingItem[];
  validateMappingRules(rules: unknown): MappingRule[];
}
