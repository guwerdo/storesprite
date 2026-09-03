import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { FileUtil } from "../../src/utils/file-util.js";

describe("FileUtil Unit Tests", () => {
  const testDir = path.join(os.tmpdir(), "file-util-tests-" + Date.now());

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should ensure directory exists", () => {
    const subDir = path.join(testDir, "sub", "folder");
    FileUtil.ensureDirExists(subDir);
    expect(fs.existsSync(subDir)).toBe(true);
  });

  it("should get file size accurately", () => {
    FileUtil.ensureDirExists(testDir);
    const testFile = path.join(testDir, "test.txt");
    fs.writeFileSync(testFile, "Hello World!");

    expect(FileUtil.getFileSize(testFile)).toBe(12);
    expect(FileUtil.getFileSize(path.join(testDir, "non-existent.txt"))).toBe(0);
  });

  it("should detect HTML content", () => {
    expect(FileUtil.isHtmlContent("<!DOCTYPE html><html><body>Error</body></html>")).toBe(true);
    expect(FileUtil.isHtmlContent("<html><head><title>Login</title></head></html>")).toBe(true);
    expect(FileUtil.isHtmlContent("sku;stock;price\n123;10;500")).toBe(false);
    expect(FileUtil.isHtmlContent("<products><product id='1'></product></products>")).toBe(false);
  });

  it("should format file paths correctly by connection ID", () => {
    const rawCsv = FileUtil.getRawFilePath("/data", "conn_123", "CSV");
    const rawXml = FileUtil.getRawFilePath("/data", "345", "XML");
    const finalCsv = FileUtil.getCsvFilePath("/data", "345");

    expect(rawCsv).toBe(path.join("/data", "conn_123.raw.csv"));
    expect(rawXml).toBe(path.join("/data", "345.raw.xml"));
    expect(finalCsv).toBe(path.join("/data", "345.csv"));
  });
});
