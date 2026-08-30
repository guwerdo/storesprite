import { Ajv, type ValidateFunction, type AnySchema } from "ajv";
import addFormatsPkg, { type FormatsPlugin } from "ajv-formats";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectable, inject, optional } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { DataConnectionChannel, DataConnectionFormat } from "../entities/DataConnection.js";
import {
  ConnectionConfig,
  DataFormatConfig,
  ConnectionCredentials,
  HttpConnectionConfig,
  SftpConnectionConfig,
  CsvDataFormatConfig,
  XmlDataFormatConfig,
  HttpCredentials,
  SftpCredentials,
  ConnectionTestResult,
} from "../types/DataConnectionRepository.interface.js";
import { StockMappingItem, MappingRule, MappingSchedule } from "../types/MappingRepository.interface.js";
import { IJsonSchemaValidator } from "../types/JsonSchemaValidator.interface.js";

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

const addFormats: FormatsPlugin =
  (addFormatsPkg as unknown as { default?: FormatsPlugin }).default || (addFormatsPkg as unknown as FormatsPlugin);

@injectable()
export class JsonSchemaValidator implements IJsonSchemaValidator {
  private readonly _ajv: Ajv;
  private readonly _validateHttpConfig: ValidateFunction<HttpConnectionConfig>;
  private readonly _validateSftpConfig: ValidateFunction<SftpConnectionConfig>;
  private readonly _validateCsvFormatConfig: ValidateFunction<CsvDataFormatConfig>;
  private readonly _validateXmlFormatConfig: ValidateFunction<XmlDataFormatConfig>;
  private readonly _validateHttpCredentials: ValidateFunction<HttpCredentials>;
  private readonly _validateSftpCredentials: ValidateFunction<SftpCredentials>;
  private readonly _validateTestResult: ValidateFunction<ConnectionTestResult>;
  private readonly _validateStockMappings: ValidateFunction<StockMappingItem[]>;
  private readonly _validateMappingRules: ValidateFunction<MappingRule[]>;
  private readonly _validateSchedule: ValidateFunction<MappingSchedule>;

  constructor(
    @inject(TYPES.Logger)
    @optional()
    private readonly _logger?: Logger
  ) {
    this._ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this._ajv);

    this._validateHttpConfig = this._compileSchema<HttpConnectionConfig>("connection-config-http.schema.json");
    this._validateSftpConfig = this._compileSchema<SftpConnectionConfig>("connection-config-sftp.schema.json");
    this._validateCsvFormatConfig = this._compileSchema<CsvDataFormatConfig>("connection-data-format-config-csv.schema.json");
    this._validateXmlFormatConfig = this._compileSchema<XmlDataFormatConfig>("connection-data-format-config-xml.schema.json");
    this._validateHttpCredentials = this._compileSchema<HttpCredentials>("connection-credentials-http.schema.json");
    this._validateSftpCredentials = this._compileSchema<SftpCredentials>("connection-credentials-sftp.schema.json");
    this._validateTestResult = this._compileSchema<ConnectionTestResult>("connection-test-result.schema.json");
    this._validateStockMappings = this._compileSchema<StockMappingItem[]>("stock-mapping-items.schema.json");
    this._validateMappingRules = this._compileSchema<MappingRule[]>("mapping-rules.schema.json");
    this._validateSchedule = this._compileSchema<MappingSchedule>("mapping-schedule.schema.json");
  }

  public validateTestResult(testResult: unknown): ConnectionTestResult {
    this._requireObject(testResult, "Test result");
    return this._assertValid(this._validateTestResult, testResult, "connection test result", { testResult });
  }

  public validateStockMappings(items: unknown): StockMappingItem[] {
    this._requireObject(items, "Stock mappings");
    return this._assertValid(this._validateStockMappings, items, "stock mappings", { items });
  }

  public validateMappingRules(rules: unknown): MappingRule[] {
    if (rules === null || rules === undefined) {
      return [];
    }
    this._requireObject(rules, "Mapping rules");
    return this._assertValid(this._validateMappingRules, rules, "mapping rules", { rules });
  }

  public validateSchedule(schedule: unknown): MappingSchedule {
    this._requireObject(schedule, "Schedule");
    return this._assertValid(this._validateSchedule, schedule, "schedule", { schedule });
  }

  public validateConfig(channel: DataConnectionChannel, config: unknown): ConnectionConfig {
    this._requireObject(config, "Transport config");

    if (channel === "HTTP") {
      return this._assertValid(this._validateHttpConfig, config, "HTTP connection config", { config });
    }
    if (channel === "SFTP") {
      return this._assertValid(this._validateSftpConfig, config, "SFTP connection config", { config });
    }

    throw new SchemaValidationError(`Unsupported channel: ${String(channel)}`);
  }

  public validateDataFormatConfig(format: DataConnectionFormat, dataFormatConfig: unknown): DataFormatConfig {
    this._requireObject(dataFormatConfig, "Data format config");

    if (format === "CSV") {
      return this._assertValid(this._validateCsvFormatConfig, dataFormatConfig, "CSV format config", { dataFormatConfig });
    }
    if (format === "XML") {
      return this._assertValid(this._validateXmlFormatConfig, dataFormatConfig, "XML format config", { dataFormatConfig });
    }

    throw new SchemaValidationError(`Unsupported data format: ${String(format)}`);
  }

  public validateCredentials(channel: DataConnectionChannel, credentials: unknown): ConnectionCredentials | null {
    if (credentials === null || credentials === undefined) {
      return null;
    }

    this._requireObject(credentials, "Credentials");

    if (channel === "HTTP") {
      return this._assertValid(this._validateHttpCredentials, credentials, "HTTP credentials");
    }
    if (channel === "SFTP") {
      return this._assertValid(this._validateSftpCredentials, credentials, "SFTP credentials");
    }

    throw new SchemaValidationError(`Unsupported channel for credentials: ${String(channel)}`);
  }

  private _compileSchema<T>(schemaName: string): ValidateFunction<T> {
    const schema = this._loadSchema(schemaName);
    return this._ajv.compile<T>(schema);
  }

  private _loadSchema(schemaName: string): AnySchema {
    const candidates = [
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schemas", schemaName),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./schemas", schemaName),
      path.resolve(process.cwd(), "src/schemas", schemaName),
      path.resolve(process.cwd(), "dist/schemas", schemaName),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        const content = readFileSync(candidate, "utf-8");
        return JSON.parse(content) as AnySchema;
      }
    }

    throw new Error(`Static JSON schema not found: ${schemaName}. Candidates searched: ${candidates.join(", ")}`);
  }

  private _formatErrors(validator: ValidateFunction): string {
    if (!validator.errors || validator.errors.length === 0) {
      return "Unknown validation error";
    }
    return validator.errors
      .map((err) => {
        const pathStr = err.instancePath ? `Field '${err.instancePath.replace(/^\//, "")}' ` : "";
        return `${pathStr}${err.message || "is invalid"}`;
      })
      .join("; ");
  }

  private _requireObject(value: unknown, label: string): asserts value is object {
    if (!value || typeof value !== "object") {
      throw new SchemaValidationError(`${label} must be a non-null object`);
    }
  }

  private _assertValid<T>(
    validator: ValidateFunction<T>,
    value: object,
    label: string,
    context?: Record<string, unknown>
  ): T {
    if (!validator(value)) {
      const errorText = this._formatErrors(validator);
      this._logger?.warn(`Invalid ${label}`, context ? { errors: errorText, ...context } : { errors: errorText });
      throw new SchemaValidationError(`Invalid ${label}: ${errorText}`);
    }
    return value;
  }
}
