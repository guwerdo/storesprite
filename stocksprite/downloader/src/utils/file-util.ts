import fs from "node:fs";
import path from "node:path";
import { DataConnectionFormat } from "../types/Connection.types.js";

export class FileUtil {
  public static ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  public static getFileSize(filePath: string): number {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.size;
      }
    } catch {
      // Ignored
    }
    return 0;
  }

  public static isHtmlContent(chunk: Buffer | Uint8Array | string): boolean {
    const text = (typeof chunk === "string" ? chunk : Buffer.from(chunk).subarray(0, 512).toString("utf-8"))
      .trim()
      .toLowerCase();

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
