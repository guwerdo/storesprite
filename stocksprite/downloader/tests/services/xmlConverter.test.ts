import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
      dataFormatConfig: { format: "XML", rowPath: "product", includeAttributes: true },
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
});
