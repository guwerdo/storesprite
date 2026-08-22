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
  }

  public validateTestResult(testResult: unknown): ConnectionTestResult {
    if (!testResult || typeof testResult !== "object") {
      throw new SchemaValidationError("Test result must be a non-null object");
    }

    const valid = this._validateTestResult(testResult);
    if (!valid) {
      const errorText = this._formatErrors(this._validateTestResult);
      this._logger?.warn("Invalid connection test result", { errors: errorText, testResult });
      throw new SchemaValidationError(`Invalid connection test result: ${errorText}`);
    }

    return testResult;
  }

  public validateConfig(channel: DataConnectionChannel, config: unknown): ConnectionConfig {
    if (!config || typeof config !== "object") {
      throw new SchemaValidationError("Transport config must be a non-null object");
    }

    if (channel === "HTTP") {
      const valid = this._validateHttpConfig(config);
      if (!valid) {
        const errorText = this._formatErrors(this._validateHttpConfig);
        this._logger?.warn("Invalid HTTP connection config", { errors: errorText, config });
        throw new SchemaValidationError(`Invalid HTTP connection config: ${errorText}`);
      }
      return config;
    }

    if (channel === "SFTP") {
      const valid = this._validateSftpConfig(config);
      if (!valid) {
        const errorText = this._formatErrors(this._validateSftpConfig);
        this._logger?.warn("Invalid SFTP connection config", { errors: errorText, config });
        throw new SchemaValidationError(`Invalid SFTP connection config: ${errorText}`);
      }
      return config;
    }

    throw new SchemaValidationError(`Unsupported channel: ${String(channel)}`);
  }

  public validateDataFormatConfig(format: DataConnectionFormat, dataFormatConfig: unknown): DataFormatConfig {
    if (!dataFormatConfig || typeof dataFormatConfig !== "object") {
      throw new SchemaValidationError("Data format config must be a non-null object");
    }

    if (format === "CSV") {
      const valid = this._validateCsvFormatConfig(dataFormatConfig);
      if (!valid) {
        const errorText = this._formatErrors(this._validateCsvFormatConfig);
        this._logger?.warn("Invalid CSV format config", { errors: errorText, dataFormatConfig });
        throw new SchemaValidationError(`Invalid CSV format config: ${errorText}`);
      }
      return dataFormatConfig;
    }

    if (format === "XML") {
      const valid = this._validateXmlFormatConfig(dataFormatConfig);
      if (!valid) {
        const errorText = this._formatErrors(this._validateXmlFormatConfig);
        this._logger?.warn("Invalid XML format config", { errors: errorText, dataFormatConfig });
        throw new SchemaValidationError(`Invalid XML format config: ${errorText}`);
      }
      return dataFormatConfig;
    }

    throw new SchemaValidationError(`Unsupported data format: ${String(format)}`);
  }

  public validateCredentials(channel: DataConnectionChannel, credentials: unknown): ConnectionCredentials | null {
    if (credentials === null || credentials === undefined) {
      return null;
    }

    if (typeof credentials !== "object") {
      throw new SchemaValidationError("Credentials must be a non-null object");
    }

    if (channel === "HTTP") {
      const valid = this._validateHttpCredentials(credentials);
      if (!valid) {
        const errorText = this._formatErrors(this._validateHttpCredentials);
        this._logger?.warn("Invalid HTTP credentials", { errors: errorText });
        throw new SchemaValidationError(`Invalid HTTP credentials: ${errorText}`);
      }
      return credentials;
    }

    if (channel === "SFTP") {
      const valid = this._validateSftpCredentials(credentials);
      if (!valid) {
        const errorText = this._formatErrors(this._validateSftpCredentials);
        this._logger?.warn("Invalid SFTP credentials", { errors: errorText });
        throw new SchemaValidationError(`Invalid SFTP credentials: ${errorText}`);
      }
      return credentials;
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
}
