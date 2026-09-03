import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import iconv from "iconv-lite";
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
      dataFormatConfig: { format: "CSV", delimiter: ",", encoding: "UTF-8" },
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

  it("should convert UTF-8-BOM encoded CSV to standardized UTF-8 CSV without BOM", async () => {
    const rawFile = path.join(testDir, "raw_bom.csv");
    const outFile = path.join(testDir, "converted_bom.csv");

    // Prepend UTF-8 BOM \uFEFF
    const content = "\uFEFFsku,terméknév,készlet\nBOM-001,Ütvefúró gép,50\nBOM-002,Fűrészlap,120\n";
    fs.writeFileSync(rawFile, content, "utf-8");

    const connection: DataConnectionDto = {
      id: "conn_bom",
      name: "BOM CSV",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "http://example.com" },
      dataFormatConfig: { format: "CSV", delimiter: ",", encoding: "UTF-8-BOM" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawFile, outFile);

    expect(result.outputPath).toBe(outFile);
    const convertedContent = fs.readFileSync(outFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    // Header must not contain BOM character
    expect(lines[0].charCodeAt(0)).not.toBe(0xfeff);
    expect(lines[0]).toBe("sku;terméknév;készlet");
    expect(lines[1]).toBe("BOM-001;Ütvefúró gép;50");
  });

  it("should convert Windows-1250 (Central European) encoded CSV with special characters to UTF-8", async () => {
    const rawFile = path.join(testDir, "raw_win1250.csv");
    const outFile = path.join(testDir, "converted_win1250.csv");

    const text = "Cikkszám,Megnevezés,Ár,Készlet\nHU-101,Árvíztűrő tükörfúrógép,12500,15\nPL-202,Młot udarowy i świder,8900,30\nCZ-303,Šroubovák a kleště,4500,45\n";
    const encodedBuffer = iconv.encode(text, "windows-1250");
    fs.writeFileSync(rawFile, encodedBuffer);

    const connection: DataConnectionDto = {
      id: "conn_win1250",
      name: "Win1250 CSV",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "http://example.com" },
      dataFormatConfig: { format: "CSV", delimiter: ",", encoding: "windows-1250" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawFile, outFile);

    expect(result.outputPath).toBe(outFile);
    const convertedContent = fs.readFileSync(outFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("Cikkszám;Megnevezés;Ár;Készlet");
    expect(lines[1]).toBe("HU-101;Árvíztűrő tükörfúrógép;12500;15");
    expect(lines[2]).toBe("PL-202;Młot udarowy i świder;8900;30");
    expect(lines[3]).toBe("CZ-303;Šroubovák a kleště;4500;45");
  });

  it("should convert Windows-1252 (Western European) encoded CSV with special characters to UTF-8", async () => {
    const rawFile = path.join(testDir, "raw_win1252.csv");
    const outFile = path.join(testDir, "converted_win1252.csv");

    const text = "Item,Description,Price\nDE-001,München Präzisionswerkzeuge Groß,€ 49.99\nFR-002,Café & Crème Chariot élévateur,€ 12.50\n";
    const encodedBuffer = iconv.encode(text, "windows-1252");
    fs.writeFileSync(rawFile, encodedBuffer);

    const connection: DataConnectionDto = {
      id: "conn_win1252",
      name: "Win1252 CSV",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "http://example.com" },
      dataFormatConfig: { format: "CSV", delimiter: ",", encoding: "windows-1252" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawFile, outFile);

    expect(result.outputPath).toBe(outFile);
    const convertedContent = fs.readFileSync(outFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("Item;Description;Price");
    expect(lines[1]).toBe("DE-001;München Präzisionswerkzeuge Groß;€ 49.99");
    expect(lines[2]).toBe("FR-002;Café & Crème Chariot élévateur;€ 12.50");
  });

  it("should convert ISO-8859-2 (Latin-2) encoded CSV with special characters to UTF-8", async () => {
    const rawFile = path.join(testDir, "raw_iso88592.csv");
    const outFile = path.join(testDir, "converted_iso88592.csv");

    const text = "Azonosító,Termék,Egységár,Mennyiség\nISO-01,Csavarhúzó készlet,3200,80\nISO-02,Fúrószár készlet (fém & fa),6400,25\n";
    const encodedBuffer = iconv.encode(text, "ISO-8859-2");
    fs.writeFileSync(rawFile, encodedBuffer);

    const connection: DataConnectionDto = {
      id: "conn_iso88592",
      name: "ISO-8859-2 CSV",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "http://example.com" },
      dataFormatConfig: { format: "CSV", delimiter: ",", encoding: "ISO-8859-2" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawFile, outFile);

    expect(result.outputPath).toBe(outFile);
    const convertedContent = fs.readFileSync(outFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("Azonosító;Termék;Egységár;Mennyiség");
    expect(lines[1]).toBe("ISO-01;Csavarhúzó készlet;3200;80");
    expect(lines[2]).toBe("ISO-02;Fúrószár készlet (fém & fa);6400;25");
  });
});
