import fs from "node:fs";
import readline from "node:readline";
import iconv from "iconv-lite";
import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { IDataConverter, ConvertResult } from "../types/DataConverter.interface.js";
import { DataConnectionDto, CsvDataFormatConfig } from "../types/Connection.types.js";
import { CliUtil } from "../utils/cli-util.js";
import { FileUtil } from "../utils/file-util.js";
import { ErrorUtil } from "../utils/error-util.js";

@injectable()
export class CsvConverter implements IDataConverter {
  constructor(@inject(TYPES.Logger) private readonly _logger: Logger) {}

  public async convert(
    connection: DataConnectionDto,
    inputRawPath: string,
    outputCsvPath: string
  ): Promise<ConvertResult> {
    const formatConfig = connection.dataFormatConfig as CsvDataFormatConfig;
    const inputDelimiter = formatConfig?.delimiter || ",";
    const encoding = formatConfig?.encoding || "utf-8";

    this._logger.info("Converting raw CSV to standardized format", {
      connectionId: connection.id,
      inputRawPath,
      outputCsvPath,
      inputDelimiter,
      encoding,
      targetDelimiter: ";",
    });

    FileUtil.ensureDirExists(outputCsvPath.substring(0, outputCsvPath.lastIndexOf("\\") > -1 ? outputCsvPath.lastIndexOf("\\") : outputCsvPath.lastIndexOf("/")));

    // Try converting using CLI tool 'csvformat'
    try {
      await CliUtil.executeCommand({
        command: "csvformat",
        args: ["-d", inputDelimiter, "-D", ";", "-e", encoding, inputRawPath],
        outputFilePath: outputCsvPath,
      });

      const byteCount = FileUtil.getFileSize(outputCsvPath);
      if (byteCount === 0) {
        throw new Error(`Converted CSV output file '${outputCsvPath}' is empty (0 bytes).`);
      }

      this._logger.info("CSV conversion finished via csvformat CLI", {
        connectionId: connection.id,
        outputCsvPath,
        byteCount,
      });

      return {
        outputPath: outputCsvPath,
        byteCount,
      };
    } catch (cliError) {
      this._logger.warn(
        "csvformat CLI conversion failed or tool not found, falling back to streaming CSV converter",
        {
          connectionId: connection.id,
          error: ErrorUtil.stringifyError(cliError),
        }
      );

      // Fallback streaming conversion for pure portability (constant O(1) memory)
      await this._streamConvertCsv(inputRawPath, outputCsvPath, inputDelimiter, encoding);

      const byteCount = FileUtil.getFileSize(outputCsvPath);
      if (byteCount === 0) {
        throw new Error(`Converted CSV output file '${outputCsvPath}' is empty (0 bytes).`);
      }

      this._logger.info("CSV conversion finished via stream fallback", {
        connectionId: connection.id,
        outputCsvPath,
        byteCount,
      });

      return {
        outputPath: outputCsvPath,
        byteCount,
      };
    }
  }

  /**
   * Streaming fallback re-delimits CSV rows with semicolon without loading the full file in memory.
   * Decodes from any source encoding (e.g. windows-1250, windows-1252, ISO-8859-2, UTF-8, UTF-8-BOM) to UTF-8.
   */
  private async _streamConvertCsv(
    inputRawPath: string,
    outputCsvPath: string,
    inputDelimiter: string,
    encoding: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const normalizedEncoding = this._normalizeEncoding(encoding);
      const inputStream = fs.createReadStream(inputRawPath);
      const decodedStream = inputStream.pipe(iconv.decodeStream(normalizedEncoding, { stripBOM: true }));
      const outputStream = fs.createWriteStream(outputCsvPath, { encoding: "utf-8" });

      const rl = readline.createInterface({
        input: decodedStream,
        crlfDelay: Infinity,
      });

      let isFirstLine = true;
      rl.on("line", (line) => {
        if (isFirstLine) {
          isFirstLine = false;
          if (line.charCodeAt(0) === 0xfeff) {
            line = line.slice(1);
          }
        }
        if (!line || line.trim().length === 0) return;

        // Reformat line delimiters
        if (inputDelimiter === ";") {
          outputStream.write(line + "\n");
        } else {
          const cells = this._splitCsvRow(line, inputDelimiter);
          const escapedCells = cells.map((cell) => {
            if (cell.includes(";") || cell.includes('"') || cell.includes("\n")) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          });
          outputStream.write(escapedCells.join(";") + "\n");
        }
      });

      rl.on("close", () => {
        outputStream.end();
        resolve();
      });

      rl.on("error", (err) => {
        outputStream.close();
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      outputStream.on("error", (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      inputStream.on("error", (err) => {
        outputStream.close();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  private _normalizeEncoding(encoding?: string): string {
    if (!encoding) return "utf-8";
    const lower = encoding.trim().toLowerCase();
    if (lower === "utf-8-bom" || lower === "utf8-bom" || lower === "utf-8 with bom") {
      return "utf-8";
    }
    return lower;
  }

  private _splitCsvRow(row: string, delimiter: string): string[] {
    const cells: string[] = [];
    let insideQuotes = false;
    let currentCell = "";

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (insideQuotes && i + 1 < row.length && row[i + 1] === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        cells.push(currentCell);
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell);

    return cells;
  }
}
