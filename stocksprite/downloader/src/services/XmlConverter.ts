import fs from "node:fs";
import iconv from "iconv-lite";
import { injectable, inject } from "inversify";
import sax from "sax";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { IDataConverter, ConvertResult } from "../types/DataConverter.interface.js";
import { DataConnectionDto, XmlDataFormatConfig } from "../types/Connection.types.js";
import { FileUtil } from "../utils/file-util.js";
import { EncodingUtil } from "../utils/encoding-util.js";

@injectable()
export class XmlConverter implements IDataConverter {
  constructor(@inject(TYPES.Logger) private readonly _logger: Logger) {}

  public async convert(
    connection: DataConnectionDto,
    inputRawPath: string,
    outputCsvPath: string
  ): Promise<ConvertResult> {
    const formatConfig = connection.dataFormatConfig as XmlDataFormatConfig;
    const targetRowTag = (formatConfig?.rowPath || "product").toLowerCase().split("/").pop() || "product";
    const includeAttributes = formatConfig?.includeAttributes !== false;
    const encoding = formatConfig?.encoding || "utf-8";

    this._logger.info("Converting raw XML to standardized CSV format via SAX stream", {
      connectionId: connection.id,
      inputRawPath,
      outputCsvPath,
      targetRowTag,
      encoding,
    });

    FileUtil.ensureDirForFile(outputCsvPath);

    return new Promise<ConvertResult>((resolve, reject) => {
      const normalizedEncoding = EncodingUtil.normalizeEncoding(encoding);
      const readStream = fs.createReadStream(inputRawPath);
      const decodedStream = readStream.pipe(iconv.decodeStream(normalizedEncoding, { stripBOM: true }));
      const writeStream = fs.createWriteStream(outputCsvPath, { encoding: "utf-8" });

      const saxStream = sax.createStream(true, { trim: true, normalize: true });

      let insideTargetRow = false;
      let currentRecord: Record<string, string> = {};
      let currentTag = "";
      let currentText = "";
      const knownHeaders: string[] = [];
      let headerWritten = false;
      let rowCount = 0;
      const initialBufferedRecords: Record<string, string>[] = [];
      const BUFFER_LIMIT_FOR_HEADER_DISCOVERY = 50;

      saxStream.on("opentag", (node) => {
        const tagName = node.name.toLowerCase();

        if (tagName === targetRowTag) {
          insideTargetRow = true;
          currentRecord = {};

          if (includeAttributes && node.attributes) {
            for (const [attrName, attrValue] of Object.entries(node.attributes)) {
              currentRecord[attrName] = String(attrValue);
            }
          }
        } else if (insideTargetRow) {
          currentTag = node.name;
          currentText = "";
        }
      });

      saxStream.on("text", (text) => {
        if (insideTargetRow && currentTag) {
          currentText += text;
        }
      });

      saxStream.on("cdata", (cdata) => {
        if (insideTargetRow && currentTag) {
          currentText += cdata;
        }
      });

      saxStream.on("closetag", (tagName) => {
        const lowerTagName = tagName.toLowerCase();

        if (lowerTagName === targetRowTag && insideTargetRow) {
          insideTargetRow = false;
          rowCount++;

          // Update header list
          for (const key of Object.keys(currentRecord)) {
            if (!knownHeaders.includes(key)) {
              knownHeaders.push(key);
            }
          }

          if (!headerWritten) {
            initialBufferedRecords.push({ ...currentRecord });
            // Once we have sampled initial records to discover headers, write header and buffered rows
            if (initialBufferedRecords.length >= BUFFER_LIMIT_FOR_HEADER_DISCOVERY) {
              writeHeaderAndBufferedRows();
            }
          } else {
            // Write row directly to disk
            writeCsvRow(currentRecord);
          }

          currentRecord = {};
          currentTag = "";
          currentText = "";
        } else if (insideTargetRow && currentTag === tagName) {
          currentRecord[currentTag] = currentText.trim();
          currentTag = "";
          currentText = "";
        }
      });

      function writeHeaderAndBufferedRows(): void {
        if (headerWritten) return;
        headerWritten = true;

        // Write header
        writeStream.write(knownHeaders.join(";") + "\n");

        // Write buffered records
        for (const rec of initialBufferedRecords) {
          writeCsvRow(rec);
        }
        initialBufferedRecords.length = 0; // Clear buffer
      }

      function writeCsvRow(record: Record<string, string>): void {
        const rowValues = knownHeaders.map((header) => {
          const val = record[header] || "";
          if (val.includes(";") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        writeStream.write(rowValues.join(";") + "\n");
      }

      saxStream.on("error", (err) => {
        writeStream.close();
        reject(new Error(`XML parsing error: ${err.message}`));
      });

      saxStream.on("end", () => {
        if (!headerWritten) {
          writeHeaderAndBufferedRows();
        }
        writeStream.end();
      });

      writeStream.on("finish", () => {
        const byteCount = FileUtil.getFileSize(outputCsvPath);
        if (byteCount === 0) {
          reject(new Error(`Converted XML to CSV output file '${outputCsvPath}' is empty (0 bytes).`));
          return;
        }

        this._logger.info("XML to CSV conversion finished successfully", {
          connectionId: connection.id,
          outputCsvPath,
          rowCount,
          byteCount,
        });

        resolve({
          outputPath: outputCsvPath,
          rowCount,
          byteCount,
        });
      });

      writeStream.on("error", (err) => {
        reject(err);
      });

      readStream.on("error", (err) => {
        writeStream.close();
        reject(err);
      });

      decodedStream.pipe(saxStream);
    });
  }

}
