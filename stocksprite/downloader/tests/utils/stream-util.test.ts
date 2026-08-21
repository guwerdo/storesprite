import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { StreamUtil } from "../../src/utils/stream-util.js";

describe("StreamUtil Unit Tests", () => {
  const testDir = path.join(os.tmpdir(), "stream-util-tests-" + Date.now());

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should compute sha256 hash of a file", async () => {
    fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, "test.txt");
    fs.writeFileSync(testFile, "test-stream-content");

    const hash = await StreamUtil.computeFileSha256(testFile);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA256 hex string length
  });

  it("should compare identical file hashes accurately", async () => {
    fs.mkdirSync(testDir, { recursive: true });
    const file1 = path.join(testDir, "file1.txt");
    const file2 = path.join(testDir, "file2.txt");
    const file3 = path.join(testDir, "file3.txt");

    fs.writeFileSync(file1, "same-content");
    fs.writeFileSync(file2, "same-content");
    fs.writeFileSync(file3, "different-content");

    expect(await StreamUtil.compareFileHash(file1, file2)).toBe(true);
    expect(await StreamUtil.compareFileHash(file1, file3)).toBe(false);
  });
});
