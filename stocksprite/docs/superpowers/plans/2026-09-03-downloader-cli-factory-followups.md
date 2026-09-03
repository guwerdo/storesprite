# Downloader CLI & Factory Follow-up Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two gaps deliberately left out of the test-suite-hardening plan: (1) `CliUtil.executeCommand` and the downloader's `csvformat` CLI/fallback paths, and (2) the "unsupported channel/format" error branches in `DownloaderFactory`, `ConverterFactory`, and `DownloaderService`.

**Architecture:** All changes are characterization tests — **no production code is modified.** Task 1 exercises `CliUtil.executeCommand` with real subprocesses (spawning `node` via `process.execPath`), which is the "real subprocess" behavior the original plan flagged. Task 2 pins both of `CsvConverter.convert`'s branches — `csvformat CLI` success and `stream fallback` — deterministically by mocking the `CliUtil` module in a dedicated test file; the existing `csvConverter.test.ts` (which today runs the real `/usr/bin/csvformat` binary because it is installed in `stocksprite-dev`) is left untouched. Tasks 3–4 test the factories directly and `DownloaderService`'s per-connection error handling through real factory instances.

**Tech Stack:** TypeScript (NodeNext ESM), Vitest v2 (downloader), `vitest-mock-extended` for logger/interface mocks. Downloader source files use **2-space indentation** — all new code below matches it.

**Spec:** None — this plan is derived from the "Deliberate non-goals (out of scope)" section of `stocksprite/docs/superpowers/plans/2026-09-03-test-suite-hardening.md`, which listed exactly these two follow-ups.

## Global Constraints

- **Directory & imports:** tests live in `downloader/test/…`, importing source via `../../src/….js` (NodeNext ESM). New files are auto-discovered by `downloader/vitest.config.ts` (`include: ["test/**/*.test.ts"]`).
- **Do not add or remove npm dependencies.** Keep the downloader's `vitest-mock-extended` idiom; do not introduce mocks for code under test where a real subprocess or real class is cheap.
- **No production code changes.** Every task asserts existing behavior (`tsc` output must be byte-identical — verify with `npm run build`).
- **Environment facts (verified 2026-09-03 in `stocksprite-dev`, Linux x86_64, node v24.19.0):**
  - `/usr/bin/csvformat` **is installed**, so today's `csvConverter.test.ts` already exercises the real CLI success branch. The genuinely environment-gated, unproven branch is `stream fallback` (only runs when the CLI fails), plus `CliUtil.executeCommand` itself has zero direct tests.
  - Real subprocess tests must be self-contained: they spawn `process.execPath` (`node`), never an external tool that may be absent.
- **Vitest module mocks are per-file.** Mocking `../../src/utils/cli-util.js` in Task 2's new file does NOT affect Task 1's file or the existing `csvConverter.test.ts`.
- **Verification runs inside the container only** (AGENTS.md mandate), via:
  `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev npm --prefix /workspace/stocksprite/downloader test`

---

### Task 1: `CliUtil.executeCommand` — real-subprocess characterization tests

`CliUtil.executeCommand` (`downloader/src/utils/cli-util.ts`) is a thin wrapper over `child_process.spawn` that streams an optional input file into the child's stdin, pipes the child's stdout to an optional output file, captures stderr, resolves on exit code 0, and rejects with a formatted message otherwise. None of that behavior is tested today.

**Files:**
- Create: `downloader/test/utils/cli-util.test.ts`

**Interfaces:**
- Consumes: `CliUtil.executeCommand(options: SpawnCliOptions): Promise<void>` where `SpawnCliOptions = { command: string; args: string[]; outputFilePath?: string; inputFilePath?: string }`.

- [ ] **Step 1: Write the test file**

The four tests spawn real `node` processes via `process.execPath`, so they run identically in the dev container and on any CI host. `waitForContent` polls for the file's final content because `executeCommand` resolves on the child's `close` event, which can precede the piped `WriteStream`'s disk flush — polling keeps the assertion race-free (and mirrors what production callers like `CsvConverter._finalize` actually depend on).

```ts
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
```

- [ ] **Step 2: Run the downloader unit tests**

Run: `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev npm --prefix /workspace/stocksprite/downloader test`
Expected: `test/utils/cli-util.test.ts` reports 4 passing tests; total suite becomes 61 (was 57).

- [ ] **Step 3: Commit**

```bash
git add stocksprite/downloader/test/utils/cli-util.test.ts
git commit -m "test(downloader): cover CliUtil.executeCommand real subprocess"
```

---

### Task 2: `CsvConverter` — pin the `csvformat CLI` and `stream fallback` branches

`CsvConverter.convert` (`downloader/src/services/CsvConverter.ts`) first runs `csvformat` via `CliUtil.executeCommand` and only falls back to its in-process streaming re-delimiter if the CLI throws. Which branch runs depends on whether a working `csvformat` is on `PATH`, so neither branch is covered deterministically: the existing `csvConverter.test.ts` hits the real CLI here (csvformat is installed) but would silently test only the fallback on a machine without it, and the fallback itself is never forced when csvformat works.

**Files:**
- Create: `downloader/test/services/csvConverter-cli.test.ts` (a second file for the class; do NOT edit `csvConverter.test.ts`)

**Interfaces:**
- Consumes: `CsvConverter.convert(connection, inputRawPath, outputCsvPath): Promise<ConvertResult>`; the CLI invocation it performs internally is `CliUtil.executeCommand({ command: "csvformat", args: ["-d", <inputDelimiter>, "-D", ";", "-e", <encoding>, <inputRawPath>], outputFilePath: <outputCsvPath> })`.

- [ ] **Step 1: Write the test file**

The file `vi.mock`s `../../src/utils/cli-util.js` (per-file — the real-subprocess file in Task 1 and the existing `csvConverter.test.ts` are unaffected), so both branches are exercised deterministically in any environment. The CLI-success test asserts the exact argument contract `CsvConverter` builds and that it finalizes with mode `csvformat CLI`; the failure test forces a reject and asserts the streaming fallback produces the converted file with mode `stream fallback`.

```ts
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
```

- [ ] **Step 2: Run the downloader unit tests**

Run: `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev npm --prefix /workspace/stocksprite/downloader test`
Expected: `test/services/csvConverter-cli.test.ts` reports 2 passing tests; total suite becomes 63. `test/services/csvConverter.test.ts` still passes unchanged (real binary path).

- [ ] **Step 3: Commit**

```bash
git add stocksprite/downloader/test/services/csvConverter-cli.test.ts
git commit -m "test(downloader): pin CsvConverter CLI and stream-fallback branches"
```

---

### Task 3: `DownloaderFactory` + `ConverterFactory` routing and unsupported-throw tests

Both factories are simple case-insensitive switch routers that throw on the default branch:
`DownloaderFactory.getDownloader(channel)` (`downloader/src/services/DownloaderFactory.ts`) → `Unsupported download channel: '<channel>'`; `ConverterFactory.getConverter(format)` (`downloader/src/services/ConverterFactory.ts`) → `Unsupported data format: '<format>'`. Neither is tested directly today.

**Files:**
- Create: `downloader/test/services/downloaderFactory.test.ts`
- Create: `downloader/test/services/converterFactory.test.ts`

**Interfaces:**
- Consumes: `new DownloaderFactory(httpDownloader: IDownloader, sftpDownloader: IDownloader)`, `getDownloader(channel: string): IDownloader`; `new ConverterFactory(csvConverter: IDataConverter, xmlConverter: IDataConverter)`, `getConverter(format: string): IDataConverter`. Routing is `channel.toUpperCase()` / `format.toUpperCase()`-based; the throw preserves the caller's original casing.

- [ ] **Step 1: Write `downloaderFactory.test.ts`**

```ts
import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import type { IDownloader } from "../../src/types/Downloader.interface.js";
import { DownloaderFactory } from "../../src/services/DownloaderFactory.js";

describe("DownloaderFactory", () => {
  const httpDownloader = { download: vi.fn() } as unknown as IDownloader;
  const sftpDownloader = { download: vi.fn() } as unknown as IDownloader;
  const factory = new DownloaderFactory(httpDownloader, sftpDownloader);

  it("returns the HTTP downloader for HTTP (case-insensitive)", () => {
    expect(factory.getDownloader("HTTP")).toBe(httpDownloader);
    expect(factory.getDownloader("http")).toBe(httpDownloader);
    expect(factory.getDownloader("Http")).toBe(httpDownloader);
  });

  it("returns the SFTP downloader for SFTP", () => {
    expect(factory.getDownloader("SFTP")).toBe(sftpDownloader);
  });

  it("throws for an unsupported channel, preserving the original casing", () => {
    expect(() => factory.getDownloader("FTP")).toThrow("Unsupported download channel: 'FTP'");
    expect(() => factory.getDownloader("ftps")).toThrow("Unsupported download channel: 'ftps'");
  });
});
```

- [ ] **Step 2: Write `converterFactory.test.ts`**

```ts
import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import type { IDataConverter } from "../../src/types/DataConverter.interface.js";
import { ConverterFactory } from "../../src/services/ConverterFactory.js";

describe("ConverterFactory", () => {
  const csvConverter = { convert: vi.fn() } as unknown as IDataConverter;
  const xmlConverter = { convert: vi.fn() } as unknown as IDataConverter;
  const factory = new ConverterFactory(csvConverter, xmlConverter);

  it("returns the CSV converter for CSV (case-insensitive)", () => {
    expect(factory.getConverter("CSV")).toBe(csvConverter);
    expect(factory.getConverter("csv")).toBe(csvConverter);
  });

  it("returns the XML converter for XML", () => {
    expect(factory.getConverter("XML")).toBe(xmlConverter);
  });

  it("throws for an unsupported data format, preserving the original casing", () => {
    expect(() => factory.getConverter("JSON")).toThrow("Unsupported data format: 'JSON'");
    expect(() => factory.getConverter("json")).toThrow("Unsupported data format: 'json'");
  });
});
```

- [ ] **Step 3: Run the downloader unit tests**

Run: `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev npm --prefix /workspace/stocksprite/downloader test`
Expected: both new files report 3 passing tests each; total suite becomes 69.

- [ ] **Step 4: Commit**

```bash
git add stocksprite/downloader/test/services/downloaderFactory.test.ts stocksprite/downloader/test/services/converterFactory.test.ts
git commit -m "test(downloader): cover factory routing and unsupported throws"
```

---

### Task 4: `DownloaderService` — unsupported channel/format surfacing via real factories

`DownloaderService.run` (`downloader/src/services/DownloaderService.ts`) calls `_downloaderFactory.getDownloader(connection.channel)` and `_converterFactory.getConverter(connection.dataFormat)` inside the per-connection `try`, so a real factory throw is caught, recorded as a per-connection `ERROR` result, and the loop continues to the next active connection. `_runTestMode` (single-connection test) catches the same throw and reports `progress: "finish", success: false` with the error message. Today the factory mocks in `downloaderService.test.ts` always return a downloader/converter, so this surfacing is never exercised.

**Files:**
- Modify: `downloader/test/services/downloaderService.test.ts`

**Interfaces:**
- Consumes: real `DownloaderFactory`/`ConverterFactory` built over the file's existing `downloaderMock`/`converterMock` (HTTP+SFTP both route to `downloaderMock`, CSV+XML both route to `converterMock`); existing fixtures/types (`AppConfig`, `IBackendApiClient`, `DataConnectionDto`, `IDownloader`, `IDataConverter`).

- [ ] **Step 1: Replace the mock-factory setup with real factories**

Swap the two factory *mocks* for real factory instances wrapping the same `downloaderMock`/`converterMock`. All five existing tests use only `HTTP`/`CSV`/`XML` connections, so routing through the real factories leaves them behaviorally identical.

Replace the import block (lines 1–13 of the current file):

```ts
import "reflect-metadata";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { DownloaderService } from "../../src/services/DownloaderService.js";
import { AppConfig } from "../../src/config/app.config.js";
import { IBackendApiClient } from "../../src/types/BackendApiClient.interface.js";
import { IDownloaderFactory, IDownloader } from "../../src/types/Downloader.interface.js";
import { IConverterFactory, IDataConverter } from "../../src/types/DataConverter.interface.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";
```

…with:

```ts
import "reflect-metadata";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mock } from "vitest-mock-extended";
import type { Logger } from "log4js";
import { DownloaderService } from "../../src/services/DownloaderService.js";
import { DownloaderFactory } from "../../src/services/DownloaderFactory.js";
import { ConverterFactory } from "../../src/services/ConverterFactory.js";
import { AppConfig } from "../../src/config/app.config.js";
import { IBackendApiClient } from "../../src/types/BackendApiClient.interface.js";
import { IDownloader } from "../../src/types/Downloader.interface.js";
import { IDataConverter } from "../../src/types/DataConverter.interface.js";
import { DataConnectionDto } from "../../src/types/Connection.types.js";
```

Replace the field declarations (lines 16–24 of the current file):

```ts
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let apiClientMock: ReturnType<typeof mock<IBackendApiClient>>;
  let downloaderFactoryMock: ReturnType<typeof mock<IDownloaderFactory>>;
  let converterFactoryMock: ReturnType<typeof mock<IConverterFactory>>;
  let downloaderMock: ReturnType<typeof mock<IDownloader>>;
  let converterMock: ReturnType<typeof mock<IDataConverter>>;
  let config: AppConfig;
  let service: DownloaderService;
```

…with:

```ts
  let loggerMock: ReturnType<typeof mock<Logger>>;
  let apiClientMock: ReturnType<typeof mock<IBackendApiClient>>;
  let downloaderFactory: DownloaderFactory;
  let converterFactory: ConverterFactory;
  let downloaderMock: ReturnType<typeof mock<IDownloader>>;
  let converterMock: ReturnType<typeof mock<IDataConverter>>;
  let config: AppConfig;
  let service: DownloaderService;
```

Replace the `beforeEach` body (lines 26–53 of the current file):

```ts
  beforeEach(() => {
    loggerMock = mock<Logger>();
    apiClientMock = mock<IBackendApiClient>();
    downloaderFactoryMock = mock<IDownloaderFactory>();
    converterFactoryMock = mock<IConverterFactory>();
    downloaderMock = mock<IDownloader>();
    converterMock = mock<IDataConverter>();

    downloaderFactoryMock.getDownloader.mockReturnValue(downloaderMock);
    converterFactoryMock.getConverter.mockReturnValue(converterMock);

    config = {
      userId: "user_mock",
      internalToken: "token_123",
      backendUrl: "http://backend:3000",
      outputDir: testDir,
    };

    service = new DownloaderService(
      config,
      loggerMock,
      apiClientMock,
      downloaderFactoryMock,
      converterFactoryMock
    );

    fs.mkdirSync(testDir, { recursive: true });
  });
```

…with:

```ts
  beforeEach(() => {
    loggerMock = mock<Logger>();
    apiClientMock = mock<IBackendApiClient>();
    downloaderMock = mock<IDownloader>();
    converterMock = mock<IDataConverter>();

    // Real factories: HTTP+SFTP route to downloaderMock, CSV+XML to converterMock.
    // Connections with an unsupported channel/format now throw for real.
    downloaderFactory = new DownloaderFactory(downloaderMock, downloaderMock);
    converterFactory = new ConverterFactory(converterMock, converterMock);

    config = {
      userId: "user_mock",
      internalToken: "token_123",
      backendUrl: "http://backend:3000",
      outputDir: testDir,
    };

    service = new DownloaderService(config, loggerMock, apiClientMock, downloaderFactory, converterFactory);

    fs.mkdirSync(testDir, { recursive: true });
  });
```

- [ ] **Step 2: Append the unsupported channel/format tests**

Insert the three tests inside the existing `describe("DownloaderService Unit Tests", …)` block, just before its closing `});` (currently the last line of the file, after the "quoted cell" test):

```ts
  it("should record an error and continue when a connection uses an unsupported channel", async () => {
    const goodConnection: DataConnectionDto = {
      id: "good_1",
      name: "Good Feed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/good.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ftpConnection = {
      id: "ftp_1",
      name: "FTP Feed",
      channel: "FTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "FTP" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as DataConnectionDto;

    apiClientMock.getUserConnections.mockResolvedValue([goodConnection, ftpConnection]);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "good_1.raw.csv"),
      isUnchanged: false,
      byteCount: 10,
    });
    converterMock.convert.mockResolvedValue({
      outputPath: path.join(testDir, "good_1.csv"),
      rowCount: 1,
      byteCount: 4,
    });

    const summary = await service.run();

    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    const ftpResult = summary.results.find((r) => r.connectionId === "ftp_1");
    expect(ftpResult?.status).toBe("ERROR");
    expect(ftpResult?.error).toContain("Unsupported download channel: 'FTP'");
    // The earlier good connection was still processed, so the loop continued.
    expect(summary.results.find((r) => r.connectionId === "good_1")?.status).toBe("OK");
  });

  it("should record an error when a connection uses an unsupported data format", async () => {
    const jsonConnection = {
      id: "json_1",
      name: "JSON Feed",
      channel: "HTTP",
      dataFormat: "JSON",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/f.json" },
      dataFormatConfig: { format: "JSON" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as DataConnectionDto;

    apiClientMock.getUserConnections.mockResolvedValue([jsonConnection]);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "json_1.raw.json"),
      isUnchanged: false,
      byteCount: 9,
    });

    const summary = await service.run();

    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("Unsupported data format: 'JSON'");
  });

  it("should report a test failure when the connection channel is unsupported", async () => {
    config.testConnectionId = "ftp_test";

    const ftpConnection = {
      id: "ftp_test",
      name: "FTP Feed",
      channel: "FTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "FTP" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as DataConnectionDto;

    apiClientMock.getConnectionById.mockResolvedValue(ftpConnection);

    const summary = await service.run();

    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(apiClientMock.reportTestResult).toHaveBeenCalledWith(
      "ftp_test",
      expect.objectContaining({
        progress: "finish",
        success: false,
        errorMessage: expect.stringContaining("Unsupported download channel: 'FTP'"),
      })
    );
  });
```

- [ ] **Step 3: Run the downloader unit tests and the build**

Run: `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev npm --prefix /workspace/stocksprite/downloader test`
Expected: all 5 pre-existing tests still pass, plus 3 new ones — `test/services/downloaderService.test.ts` reports 8 tests; total suite becomes 72.
Then run: `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev npm --prefix /workspace/stocksprite/downloader run build`
Expected: `tsc` succeeds (no production change, so `dist/` output is unchanged apart from the fresh compile).

- [ ] **Step 4: Commit**

```bash
git add stocksprite/downloader/test/services/downloaderService.test.ts
git commit -m "test(downloader): cover unsupported channel/format in DownloaderService"
```

---

## Self-Review

- **Spec coverage:** Both gaps named in the prior plan's "Deliberate non-goals" have a task — `CliUtil.executeCommand` + the `csvformat` CLI/fallback paths (Tasks 1–2), and the `DownloaderFactory`/`ConverterFactory`/`DownloaderService` unsupported-channel/format throws (Tasks 3–4). No other gap from that list is in scope.
- **Placeholder scan:** Every step carries complete code; no "TBD"/"similar to Task N".
- **Behavior match (read from source, not guessed):**
  - `CliUtil.executeCommand` messages: `Failed to start command '<command>'` (spawn error) and `Command '<cmd> <args…>' exited with code <n>. Error: <stderr>` — asserted exactly in Task 1.
  - `CsvConverter` logs: warn `csvformat CLI conversion failed or tool not found, falling back to streaming CSV converter`; info `CSV conversion finished via csvformat CLI` / `CSV conversion finished via stream fallback` — asserted exactly in Task 2. The CLI arg contract (`-d <in> -D ; -e <enc> <input>` + `outputFilePath`) is asserted from the actual invocation in `CsvConverter.ts:41-45`.
  - Factory throw strings and case-insensitive routing — asserted exactly in Task 3 from `DownloaderFactory.ts:13-20` and `ConverterFactory.ts:12-21`.
  - `DownloaderService` per-connection `try` catches the factory throw and continues; `_runTestMode` reports `success: false` with the message — asserted in Task 4 from `DownloaderService.ts:75-119` and `:226-246`.
- **Environment dependence removed where it matters:** Task 2 mocks the CLI seam so both branches pass whether or not `csvformat` is installed; the real binary path stays covered by the untouched `csvConverter.test.ts` (csvformat present in the dev container) and by the container integration suite.
- **Determinism of subprocess tests:** Task 1 spawns only `process.execPath` (`node`), never an external tool, and `waitForContent` guards the resolve-vs-flush race, so the suite is not flaky on slow I/O.
- **Type consistency:** `SpawnCliOptions`, `ConvertResult`, `IDownloader`, `IDataConverter`, and the `DataConnectionDto` fixture shapes match the downloader's existing types; unsupported `FTP`/`JSON` literals are cast through `unknown` because they are not members of the `DataConnectionChannel`/`DataConnectionFormat` unions (esbuild does not type-check tests, but the cast keeps editors quiet).
