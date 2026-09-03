import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { CsvConverter } from "../../src/services/CsvConverter.js";
import { CliUtil } from "../../src/utils/cli-util.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";

// Mock the CLI seam so both CsvConverter branches are pinned deterministically,
// independent of whether a real `csvformat` binary is installed on the host.
vi.mock("../../src/utils/cli-util.js", () => ({
  CliUtil: { executeCommand: vi.fn() },
}));

const executeCommandMock = vi.mocked(CliUtil.executeCommand);

function makeCsvConnection(): DataConnectionDto {
  return {
    id: "conn_csv",
    name: "Test CSV",
    channel: "HTTP",
    dataFormat: "CSV",
    isActive: true,
    config: { channel: "HTTP", url: "http://example.com" },
    dataFormatConfig: { format: "CSV", delimiter: ",", encoding: "utf-8" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as DataConnectionDto;
}

describe("CsvConverter CLI selection (CliUtil mocked)", () => {
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let converter: CsvConverter;
  const testDir = path.join(os.tmpdir(), "csv-converter-cli-tests-" + Date.now());

  beforeEach(() => {
    loggerMock = mock<Logger>();
    converter = new CsvConverter(loggerMock);
    fs.mkdirSync(testDir, { recursive: true });
    executeCommandMock.mockReset();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("uses the csvformat CLI output and finalizes as 'csvformat CLI' when the command succeeds", async () => {
    const rawFile = path.join(testDir, "raw.csv");
    const outFile = path.join(testDir, "out.csv");
    fs.writeFileSync(rawFile, "sku,name\n1,Item\n", "utf-8");
    const cliOutput = "sku;name\n1;Item\n";
    executeCommandMock.mockImplementation(async (options) => {
      if (!options.outputFilePath) {
        throw new Error("expected outputFilePath");
      }
      fs.writeFileSync(options.outputFilePath, cliOutput, "utf-8");
    });

    const result = await converter.convert(makeCsvConnection(), rawFile, outFile);

    expect(executeCommandMock).toHaveBeenCalledWith({
      command: "csvformat",
      args: ["-d", ",", "-D", ";", "-e", "utf-8", rawFile],
      outputFilePath: outFile,
    });
    expect(result.outputPath).toBe(outFile);
    expect(result.byteCount).toBe(Buffer.byteLength(cliOutput));
    expect(fs.readFileSync(outFile, "utf-8")).toBe(cliOutput);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "CSV conversion finished via csvformat CLI",
      expect.objectContaining({ connectionId: "conn_csv" })
    );
  });

  it("falls back to the streaming converter and finalizes as 'stream fallback' when the CLI command fails", async () => {
    const rawFile = path.join(testDir, "raw.csv");
    const outFile = path.join(testDir, "out.csv");
    fs.writeFileSync(rawFile, "sku,name,stock\n1,Item,2\n", "utf-8");
    executeCommandMock.mockRejectedValue(new Error("spawn csvformat ENOENT"));

    const result = await converter.convert(makeCsvConnection(), rawFile, outFile);

    expect(executeCommandMock).toHaveBeenCalledTimes(1);
    expect(result.outputPath).toBe(outFile);
    expect(fs.readFileSync(outFile, "utf-8")).toBe("sku;name;stock\n1;Item;2\n");
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "csvformat CLI conversion failed or tool not found, falling back to streaming CSV converter",
      expect.objectContaining({ connectionId: "conn_csv" })
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      "CSV conversion finished via stream fallback",
      expect.objectContaining({ connectionId: "conn_csv" })
    );
  });
});
