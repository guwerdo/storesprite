import {
  ConnectionConfig,
  DataFormatConfig,
} from "../types/DataConnectionRepository.interface.js";

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

export const DataConnectionValidator = {
  validateConfig(channel: string, config: unknown): ConnectionConfig {
    if (!config || typeof config !== "object") {
      throw new SchemaValidationError("Transport config must be a non-null object");
    }

    const cfg = config as Record<string, unknown>;

    if (channel === "HTTP") {
      if (typeof cfg.url !== "string" || cfg.url.trim().length === 0) {
        throw new SchemaValidationError("HTTP connection requires a non-empty 'url'");
      }
      try {
        new URL(cfg.url);
      } catch {
        throw new SchemaValidationError("HTTP connection 'url' must be a valid URL");
      }

      if (cfg.method !== undefined && cfg.method !== "GET" && cfg.method !== "POST") {
        throw new SchemaValidationError("HTTP method must be either 'GET' or 'POST'");
      }

      if (cfg.insecureIgnoreSsl !== undefined && typeof cfg.insecureIgnoreSsl !== "boolean") {
        throw new SchemaValidationError("HTTP 'insecureIgnoreSsl' must be a boolean");
      }

      if (cfg.timeoutSeconds !== undefined && (typeof cfg.timeoutSeconds !== "number" || cfg.timeoutSeconds <= 0)) {
        throw new SchemaValidationError("HTTP 'timeoutSeconds' must be a positive number");
      }

      const validatedMethod: "GET" | "POST" = cfg.method === "POST" ? "POST" : "GET";

      return {
        channel: "HTTP",
        url: cfg.url.trim(),
        method: validatedMethod,
        insecureIgnoreSsl: Boolean(cfg.insecureIgnoreSsl),
        timeoutSeconds: typeof cfg.timeoutSeconds === "number" ? cfg.timeoutSeconds : undefined,
      };
    }

    if (channel === "SFTP") {
      if (typeof cfg.host !== "string" || cfg.host.trim().length === 0) {
        throw new SchemaValidationError("SFTP connection requires a non-empty 'host'");
      }

      if (cfg.port !== undefined && (typeof cfg.port !== "number" || cfg.port <= 0 || cfg.port > 65535)) {
        throw new SchemaValidationError("SFTP 'port' must be a valid port number (1-65535)");
      }

      if (typeof cfg.remoteDir !== "string" || cfg.remoteDir.trim().length === 0) {
        throw new SchemaValidationError("SFTP connection requires a non-empty 'remoteDir'");
      }

      const validStrategies = ["LATEST_ALPHABETICAL", "LATEST_MODIFIED", "EXACT_MATCH"];
      if (cfg.fileSelectionStrategy !== undefined && !validStrategies.includes(cfg.fileSelectionStrategy as string)) {
        throw new SchemaValidationError(
          `SFTP 'fileSelectionStrategy' must be one of: ${validStrategies.join(", ")}`
        );
      }

      const strategy = (cfg.fileSelectionStrategy as "LATEST_ALPHABETICAL" | "LATEST_MODIFIED" | "EXACT_MATCH") || "LATEST_ALPHABETICAL";

      return {
        channel: "SFTP",
        host: cfg.host.trim(),
        port: typeof cfg.port === "number" ? cfg.port : 22,
        remoteDir: cfg.remoteDir.trim(),
        fileSelectionStrategy: strategy,
      };
    }

    throw new SchemaValidationError(`Unsupported channel: ${channel}`);
  },

  validateDataFormatConfig(format: string, dataFormatConfig: unknown): DataFormatConfig {
    if (!dataFormatConfig || typeof dataFormatConfig !== "object") {
      throw new SchemaValidationError("Data format config must be a non-null object");
    }

    const cfg = dataFormatConfig as Record<string, unknown>;

    if (format === "CSV") {
      if (typeof cfg.delimiter !== "string" || cfg.delimiter.length === 0) {
        throw new SchemaValidationError("CSV data format requires a non-empty 'delimiter'");
      }

      if (cfg.encoding !== undefined && typeof cfg.encoding !== "string") {
        throw new SchemaValidationError("CSV 'encoding' must be a string");
      }

      if (cfg.hasHeaders !== undefined && typeof cfg.hasHeaders !== "boolean") {
        throw new SchemaValidationError("CSV 'hasHeaders' must be a boolean");
      }

      return {
        format: "CSV",
        delimiter: cfg.delimiter,
        encoding: typeof cfg.encoding === "string" ? cfg.encoding : "UTF-8",
        hasHeaders: cfg.hasHeaders !== undefined ? Boolean(cfg.hasHeaders) : true,
      };
    }

    if (format === "XML") {
      if (typeof cfg.rowPath !== "string" || cfg.rowPath.trim().length === 0) {
        throw new SchemaValidationError("XML data format requires a non-empty 'rowPath'");
      }

      if (cfg.includeAttributes !== undefined && typeof cfg.includeAttributes !== "boolean") {
        throw new SchemaValidationError("XML 'includeAttributes' must be a boolean");
      }

      if (cfg.attributePrefix !== undefined && typeof cfg.attributePrefix !== "string") {
        throw new SchemaValidationError("XML 'attributePrefix' must be a string");
      }

      return {
        format: "XML",
        rowPath: cfg.rowPath.trim(),
        includeAttributes: Boolean(cfg.includeAttributes),
        attributePrefix: typeof cfg.attributePrefix === "string" ? cfg.attributePrefix : "",
      };
    }

    throw new SchemaValidationError(`Unsupported data format: ${format}`);
  },
};
