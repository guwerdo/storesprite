import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CliUtil } from "../../src/utils/cli-util.js";

describe("CliUtil.executeCommand (real subprocess)", () => {
  const testDir = path.join(os.tmpdir(), "cli-util-tests-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // resolve() fires on the child's 'close', which can precede the piped
  // WriteStream finishing its disk flush; poll until the file is durable.
  async function waitForContent(filePath: string, expected: string): Promise<void> {
    const deadline = Date.now() + 3000;
    while (true) {
      if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf-8") === expected) {
        return;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for '${filePath}' to contain: ${JSON.stringify(expected)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it("resolves and writes the child's stdout to outputFilePath on exit 0", async () => {
    const outFile = path.join(testDir, "out.txt");

    await expect(
      CliUtil.executeCommand({
        command: process.execPath,
        args: ["-e", "process.stdout.write('hello from child')"],
        outputFilePath: outFile,
      })
    ).resolves.toBeUndefined();

    await waitForContent(outFile, "hello from child");
  });

  it("streams inputFilePath into the child's stdin and pipes its stdout to the output file", async () => {
    const inFile = path.join(testDir, "in.txt");
    const outFile = path.join(testDir, "out.txt");
    fs.writeFileSync(inFile, "abc\ndef\n", "utf-8");

    await expect(
      CliUtil.executeCommand({
        command: process.execPath,
        args: [
          "-e",
          "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(d.toUpperCase()))",
        ],
        inputFilePath: inFile,
        outputFilePath: outFile,
      })
    ).resolves.toBeUndefined();

    await waitForContent(outFile, "ABC\nDEF\n");
  });

  it("rejects with the exit code and captured stderr when the command exits non-zero", async () => {
    let message = "";
    try {
      await CliUtil.executeCommand({
        command: process.execPath,
        args: ["-e", "console.error('kaboom');process.exit(3)"],
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("exited with code 3");
    expect(message).toContain("kaboom");
  });

  it("rejects when the executable cannot be started", async () => {
    const bogusCommand = "definitely-not-a-real-binary-xyz";

    await expect(CliUtil.executeCommand({ command: bogusCommand, args: [] })).rejects.toThrow(
      `Failed to start command '${bogusCommand}'`
    );
  });
});
