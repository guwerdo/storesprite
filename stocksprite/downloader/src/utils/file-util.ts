import fs from "node:fs";
import path from "node:path";
import { DataConnectionFormat } from "../types/connection.types.js";

export class FileUtil {
  public static ensureDirExists(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  public static ensureDirForFile(filePath: string): void {
    this.ensureDirExists(path.dirname(filePath));
  }

  public static deleteFileIfExists(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignored
    }
  }

  public static getFileSize(filePath: string): number {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  public static isHtmlContent(chunk: Buffer | Uint8Array | string): boolean {
    const prefix =
      typeof chunk === "string"
        ? chunk
        : (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)).subarray(0, 512).toString("utf-8");
    const text = prefix.trim().toLowerCase();

    return text.startsWith("<!doctype html") || text.startsWith("<html") || text.includes("<head") || text.includes("<body");
  }

  public static getRawFileExtension(dataFormat: DataConnectionFormat): string {
    return dataFormat === "XML" ? "xml" : "csv";
  }

  public static getRawFilePath(outputDir: string, connectionId: string, dataFormat: DataConnectionFormat): string {
    const ext = this.getRawFileExtension(dataFormat);
    return path.join(outputDir, `${connectionId}.raw.${ext}`);
  }

  public static getCsvFilePath(outputDir: string, connectionId: string): string {
    return path.join(outputDir, `${connectionId}.csv`);
  }
}
