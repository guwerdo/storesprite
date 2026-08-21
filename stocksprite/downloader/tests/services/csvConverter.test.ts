import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { CsvConverter } from "../../src/services/CsvConverter.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";

describe("CsvConverter Unit Tests", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let converter: CsvConverter;
  const testDir = path.join(os.tmpdir(), "csv-converter-tests-" + Date.now());

  beforeEach(() => {
    loggerMock = mock<Logger>();
    converter = new CsvConverter(loggerMock);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should convert comma-delimited raw CSV into semicolon-delimited CSV", async () => {
    const rawFile = path.join(testDir, "raw.csv");
    const outFile = path.join(testDir, "converted.csv");

    fs.writeFileSync(rawFile, 'sku,name,stock\n"SKU,001",Item One,15\nSKU002,"Item;Two",20\n');

    const connection: DataConnectionDto = {
      id: "conn_1",
      name: "Test CSV",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "http://example.com" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawFile, outFile);

    expect(result.outputPath).toBe(outFile);
    expect(fs.existsSync(outFile)).toBe(true);

    const convertedContent = fs.readFileSync(outFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("sku;name;stock");
    expect(lines[1]).toBe("SKU,001;Item One;15");
    expect(lines[2]).toBe('SKU002;"Item;Two";20');
  });
});
