import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import iconv from "iconv-lite";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { XmlConverter } from "../../src/services/XmlConverter.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";

describe("XmlConverter Unit Tests", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let converter: XmlConverter;
  const testDir = path.join(os.tmpdir(), "xml-converter-tests-" + Date.now());

  beforeEach(() => {
    loggerMock = mock<Logger>();
    converter = new XmlConverter(loggerMock);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should stream and convert XML with attributes and child elements to standardized CSV", async () => {
    const rawXmlFile = path.join(testDir, "madalbal.raw.xml");
    const outCsvFile = path.join(testDir, "madalbal.csv");

    const xmlData = `<?xml version="1.0" encoding="utf-8"?>
<products>
  <product id="1001">
    <stockAmount>25</stockAmount>
    <price>1990</price>
  </product>
  <product id="1002">
    <stockAmount>0</stockAmount>
    <price>3500</price>
  </product>
</products>`;

    fs.writeFileSync(rawXmlFile, xmlData, "utf-8");

    const connection: DataConnectionDto = {
      id: "conn_xml",
      name: "Madalbal",
      channel: "HTTP",
      dataFormat: "XML",
      isActive: true,
      config: { channel: "HTTP", url: "https://xml.madalbal.hu/xml" },
      dataFormatConfig: { format: "XML", rowPath: "product", includeAttributes: true, encoding: "UTF-8" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawXmlFile, outCsvFile);

    expect(result.outputPath).toBe(outCsvFile);
    expect(result.rowCount).toBe(2);
    expect(fs.existsSync(outCsvFile)).toBe(true);

    const convertedContent = fs.readFileSync(outCsvFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("id;stockAmount;price");
    expect(lines[1]).toBe("1001;25;1990");
    expect(lines[2]).toBe("1002;0;3500");
  });

  it("should convert UTF-8-BOM encoded XML to standardized UTF-8 CSV", async () => {
    const rawXmlFile = path.join(testDir, "bom.raw.xml");
    const outCsvFile = path.join(testDir, "bom.csv");

    const xmlData = `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<catalog>
  <item sku="BOM-XML-01">
    <title>Gérvágó fűrész</title>
    <qty>10</qty>
  </item>
</catalog>`;

    fs.writeFileSync(rawXmlFile, xmlData, "utf-8");

    const connection: DataConnectionDto = {
      id: "conn_xml_bom",
      name: "XML BOM",
      channel: "HTTP",
      dataFormat: "XML",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/feed.xml" },
      dataFormatConfig: { format: "XML", rowPath: "item", includeAttributes: true, encoding: "UTF-8-BOM" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawXmlFile, outCsvFile);

    expect(result.outputPath).toBe(outCsvFile);
    const convertedContent = fs.readFileSync(outCsvFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("sku;title;qty");
    expect(lines[1]).toBe("BOM-XML-01;Gérvágó fűrész;10");
  });

  it("should convert Windows-1250 (Central European) encoded XML to UTF-8 CSV", async () => {
    const rawXmlFile = path.join(testDir, "win1250.raw.xml");
    const outCsvFile = path.join(testDir, "win1250.csv");

    const xmlData = `<?xml version="1.0" encoding="windows-1250"?>
<catalog>
  <product>
    <sku>HU-WIN-01</sku>
    <name>Árvíztűrő tükörfúrógép és fűrészlap</name>
    <ar>18900</ar>
  </product>
  <product>
    <sku>PL-WIN-02</sku>
    <name>Wiertarka udarowa i piła stołowa</name>
    <ar>24500</ar>
  </product>
</catalog>`;

    const encodedBuffer = iconv.encode(xmlData, "windows-1250");
    fs.writeFileSync(rawXmlFile, encodedBuffer);

    const connection: DataConnectionDto = {
      id: "conn_xml_win1250",
      name: "XML Win1250",
      channel: "HTTP",
      dataFormat: "XML",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/feed.xml" },
      dataFormatConfig: { format: "XML", rowPath: "product", includeAttributes: false, encoding: "windows-1250" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawXmlFile, outCsvFile);

    expect(result.outputPath).toBe(outCsvFile);
    const convertedContent = fs.readFileSync(outCsvFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("sku;name;ar");
    expect(lines[1]).toBe("HU-WIN-01;Árvíztűrő tükörfúrógép és fűrészlap;18900");
    expect(lines[2]).toBe("PL-WIN-02;Wiertarka udarowa i piła stołowa;24500");
  });

  it("should convert Windows-1252 (Western European) encoded XML to UTF-8 CSV", async () => {
    const rawXmlFile = path.join(testDir, "win1252.raw.xml");
    const outCsvFile = path.join(testDir, "win1252.csv");

    const xmlData = `<?xml version="1.0" encoding="windows-1252"?>
<inventory>
  <item code="DE-1252">
    <desc>Große Präzisionszange &amp; Hammer</desc>
    <price>€ 29.90</price>
  </item>
</inventory>`;

    const encodedBuffer = iconv.encode(xmlData, "windows-1252");
    fs.writeFileSync(rawXmlFile, encodedBuffer);

    const connection: DataConnectionDto = {
      id: "conn_xml_win1252",
      name: "XML Win1252",
      channel: "HTTP",
      dataFormat: "XML",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/feed.xml" },
      dataFormatConfig: { format: "XML", rowPath: "item", includeAttributes: true, encoding: "windows-1252" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawXmlFile, outCsvFile);

    expect(result.outputPath).toBe(outCsvFile);
    const convertedContent = fs.readFileSync(outCsvFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("code;desc;price");
    expect(lines[1]).toBe("DE-1252;Große Präzisionszange & Hammer;€ 29.90");
  });

  it("should convert ISO-8859-2 (Latin-2) encoded XML to UTF-8 CSV", async () => {
    const rawXmlFile = path.join(testDir, "iso88592.raw.xml");
    const outCsvFile = path.join(testDir, "iso88592.csv");

    const xmlData = `<?xml version="1.0" encoding="ISO-8859-2"?>
<shop>
  <cikk>
    <kod>ISO-LATIN2</kod>
    <megnevezes>Akkus fúró-csavarozó készlet</megnevezes>
    <keszlet>35</keszlet>
  </cikk>
</shop>`;

    const encodedBuffer = iconv.encode(xmlData, "ISO-8859-2");
    fs.writeFileSync(rawXmlFile, encodedBuffer);

    const connection: DataConnectionDto = {
      id: "conn_xml_iso88592",
      name: "XML ISO-8859-2",
      channel: "HTTP",
      dataFormat: "XML",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/feed.xml" },
      dataFormatConfig: { format: "XML", rowPath: "cikk", includeAttributes: false, encoding: "ISO-8859-2" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await converter.convert(connection, rawXmlFile, outCsvFile);

    expect(result.outputPath).toBe(outCsvFile);
    const convertedContent = fs.readFileSync(outCsvFile, "utf-8");
    const lines = convertedContent.trim().split("\n");

    expect(lines[0]).toBe("kod;megnevezes;keszlet");
    expect(lines[1]).toBe("ISO-LATIN2;Akkus fúró-csavarozó készlet;35");
  });
});
