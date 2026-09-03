# Test-Suite Hardening & Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-value gaps in the downloader and processor unit-test suites, and unify the two projects' test layout on a `test/` directory so `npm run test` means "unit tests only" in both.

**Architecture:** Two phases. Phase 1 (Tasks 1–2) is a small refactor: move the processor's colocated tests into a `test/` directory mirroring `src/`, extract its duplicated `stubLogger` helper, rename the downloader's `tests/` to `test/`, and split the processor's integration test out of the default `vitest run` using a dedicated config (mirroring the downloader's existing `vitest.integration.config.ts`). Phase 2 (Tasks 3–9) adds prioritized characterization tests for already-existing code (pure utils first, then downloader auth/error branches).

**Tech Stack:** TypeScript (NodeNext ESM), Vitest (downloader v2, processor v4 — do not change versions), `vitest-mock-extended` (downloader only), `vi.mock` / `vi.fn` (processor).

**Spec:** None — this plan is derived from the session's test-suite investigation. Requirements are captured inline in the Goal/Architecture and each task's files.

## Global Constraints

- **Directory name:** `test/` (singular) for both projects. The processor already uses `test/`; the downloader's `tests/` is renamed to `test/`.
- **Import style:** tests import source with a `.js` extension (NodeNext ESM). From `test/services/*.test.ts` the source lives at `../../src/…`.
- **Do not add or remove npm dependencies.** The processor keeps its hand-rolled `stubLogger`; the downloader keeps `vitest-mock-extended`. Unifying the *mocking idiom* across projects is explicitly out of scope for this plan.
- **`npm run test` must run unit tests only in both projects; `npm run test:integration` runs integration only.**
- The downloader's unit config already excludes integration because the integration file is named `test-integration.ts` (not `.test.ts`) — preserve that. The processor's integration file *is* `*.test.ts`, so it must be excluded explicitly.

---

### Task 1: Processor — move unit tests to `test/` & split integration out of `npm run test`

**Files:**
- Create: `processor/test/helpers/stub-logger.ts`
- Create: `processor/vitest.integration.config.ts`
- Modify: `processor/vitest.config.ts`
- Modify: `processor/package.json`
- Move (git mv) the 6 colocated tests:
  - `processor/src/services/processor.service.test.ts` → `processor/test/services/processor.service.test.ts`
  - `processor/src/services/rule-transform.service.test.ts` → `processor/test/services/rule-transform.service.test.ts`
  - `processor/src/services/connection-feed.service.test.ts` → `processor/test/services/connection-feed.service.test.ts`
  - `processor/src/services/unas-product-db.service.test.ts` → `processor/test/services/unas-product-db.service.test.ts`
  - `processor/src/services/unas-update.service.test.ts` → `processor/test/services/unas-update.service.test.ts`
  - `processor/src/services/backend-api-client.test.ts` → `processor/test/services/backend-api-client.test.ts`

Note: `processor/test/setup.ts`, `processor/test/integration/**`, `processor/tsconfig.json` (`exclude: [..., "test", ...]`), and `processor/eslint.config.js` (`globalIgnores([..., "test/", ...])`) already conform to `test/` — **no change** to any of those.

**Interfaces:**
- Produces: `processor/test/helpers/stub-logger.ts` exports `stubLogger(overrides?: Partial<Logger>): Logger`. Later tasks import it from `../helpers/stub-logger.js`.

- [ ] **Step 1: Create the shared stub-logger helper**

Write `processor/test/helpers/stub-logger.ts`:

```ts
import { vi } from "vitest";
import type { Logger } from "log4js";

/** Shared no-op logger for unit tests. Pass field overrides to assert on a specific method. */
export function stubLogger(overrides: Partial<Logger> = {}): Logger {
    return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        mark: vi.fn(),
        ...overrides,
    } as unknown as Logger;
}
```

- [ ] **Step 2: Move the files with `git mv`**

Run, from `stocksprite/processor/`:

```bash
mkdir -p test/services test/helpers
git mv src/services/processor.service.test.ts test/services/processor.service.test.ts
git mv src/services/rule-transform.service.test.ts test/services/rule-transform.service.test.ts
git mv src/services/connection-feed.service.test.ts test/services/connection-feed.service.test.ts
git mv src/services/unas-product-db.service.test.ts test/services/unas-product-db.service.test.ts
git mv src/services/unas-update.service.test.ts test/services/unas-update.service.test.ts
git mv src/services/backend-api-client.test.ts test/services/backend-api-client.test.ts
```

- [ ] **Step 3: Fix import paths in the moved `test/services/*.test.ts` files**

For each moved service test, change source imports to point at `../../src/…`:

- `./processor.service.js` → `../../src/services/processor.service.js`
- `./backend-api-client.js` → `../../src/services/backend-api-client.js`
- `./connection-feed.service.js` → `../../src/services/connection-feed.service.js`
- `./unas-product-db.service.js` → `../../src/services/unas-product-db.service.js`
- `./unas-update.service.js` → `../../src/services/unas-update.service.js`
- `./rule-transform.service.js` → `../../src/services/rule-transform.service.js`
- `../config/app.config.js` → `../../src/config/app.config.js`
- `../config/unas-csv-column-names.js` → `../../src/config/unas-csv-column-names.js`
- `../repository/connection-index.repository.js` → `../../src/repository/connection-index.repository.js`
- `../types/mapping.interface.js` → `../../src/types/mapping.interface.js`
- `../types/connection.interface.js` → `../../src/types/connection.interface.js`
- `../utils/http-util.js` → `../../src/utils/http-util.js` (in `unas-update.service.test.ts`'s `vi.mock`)
- `../utils/mapping-util.js` → `../../src/utils/mapping-util.js`

- [ ] **Step 4: Replace each file's local `stubLogger` with the shared helper**

In `processor.service.test.ts`, `connection-feed.service.test.ts`, `backend-api-client.test.ts`, and `unas-update.service.test.ts`: delete the local `function stubLogger()…` definition and add:

```ts
import { stubLogger } from "../helpers/stub-logger.js";
```

In `unas-product-db.service.test.ts`, delete the local `function stubLogger(warn…)…`, import the helper as above, and change its call sites `stubLogger()` → `stubLogger()` (unchanged) and `stubLogger(warn)` → `stubLogger({ warn })`.

- [ ] **Step 5: Restrict the default config to unit tests**

In `processor/vitest.config.ts`, replace the `include` array:

```ts
include: ["./src/**/*.test.ts", "./src/**/*.spec.ts", "./test/integration/**/*.test.ts"],
```

with:

```ts
include: ["./test/**/*.test.ts"],
exclude: ["node_modules", "dist", "temp", "./test/integration/**"],
```

Leave `setupFiles: ["./test/setup.ts"]` and the other fields (`env`, `globals`, timeouts, `server.watch`, `typecheck`) unchanged.

- [ ] **Step 6: Add the dedicated integration config**

Write `processor/vitest.integration.config.ts` (mirrors the downloader's):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        env: { NODE_ENV: "test", VITEST: "true" },
        include: ["./test/integration/**/*.test.ts"],
        setupFiles: ["./test/setup.ts"],
        globals: true,
        testTimeout: 60000,
        hookTimeout: 60000,
    },
});
```

- [ ] **Step 7: Update the `test:integration` script**

In `processor/package.json`, change:

```json
"test:integration": "vitest run test/integration/processor.integration.test.ts",
```

to:

```json
"test:integration": "vitest run -c vitest.integration.config.ts",
```

- [ ] **Step 8: Verify**

Run from `stocksprite/processor/`:

```bash
npm run test               # expects only unit tests (6 files) to run and pass
npm run test:integration   # expects only the integration test to run
npm run build              # expects tsc to succeed and dist/ to contain NO *.test.js
```

Expected: unit count unchanged (the suites are unchanged, just relocated); integration runs only under `test:integration`; `dist/` has no test files (colocated tests are now outside `src/`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(processor): move unit tests to test/, split integration config"
```

---

### Task 2: Downloader — rename `tests/` to `test/`

**Files:**
- Move (git mv): `downloader/tests/**` → `downloader/test/**`
- Modify: `downloader/vitest.config.ts`
- Modify: `downloader/vitest.integration.config.ts`
- Modify: `stocksprite/readme.md:86`

Note: no import changes are needed — `downloader/tests/services/*.test.ts` already imports `../../src/…`, and `test/services/` is the same depth. No `tsconfig.json` change (its `exclude` lists `**/*.test.ts`, not a directory) and no `.gitignore` change (it ignores `node_modules/`, `dist/`, `temp/` only).

- [ ] **Step 1: Rename the directory**

Run, from `stocksprite/downloader/`:

```bash
git mv tests test
```

- [ ] **Step 2: Update the unit config**

In `downloader/vitest.config.ts`, change `include: ["tests/**/*.test.ts"]` → `include: ["test/**/*.test.ts"]`. Leave `exclude: ["node_modules", "dist", "temp"]` unchanged.

- [ ] **Step 3: Update the integration config**

In `downloader/vitest.integration.config.ts`, change `include: ["tests/integration/**/*.ts"]` → `include: ["test/integration/**/*.ts"]`.

- [ ] **Step 4: Update the readme reference**

In `stocksprite/readme.md:86`, change `downloader/tests/integration/docker-compose-test-integration.yaml` → `downloader/test/integration/docker-compose-test-integration.yaml`.

- [ ] **Step 5: Verify**

Run from `stocksprite/downloader/`:

```bash
npm run test               # expects the unit suite to run and pass from test/
npm run test:integration   # expects the integration suite config to resolve test/integration/
```

Expected: identical test counts as before the rename; no path-resolution errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(downloader): rename tests/ to test/"
```

---

### Task 3: Processor — `mapping-util` tests (highest-value pure logic)

**Files:**
- Create: `processor/test/utils/mapping-util.test.ts`

**Interfaces:**
- Consumes (from `processor/src/utils/mapping-util.ts`): `getNumberValue(value, lenient?)`, `getStringValue(value)`, `negativeToZero(value)`, `stocksEqual(a, b)`, `computeFinalStocks(current, desired)`, `toStockArray(stocks)`, `MAIN_WAREHOUSE_ID` (= 1).

- [ ] **Step 1: Write the test file**

```ts
import { describe, expect, it } from "vitest";
import {
    MAIN_WAREHOUSE_ID,
    computeFinalStocks,
    getNumberValue,
    getStringValue,
    negativeToZero,
    stocksEqual,
    toStockArray,
} from "../../src/utils/mapping-util.js";

describe("mapping-util", () => {
    describe("getNumberValue", () => {
        it("returns a number unchanged", () => {
            expect(getNumberValue(5)).toBe(5);
        });
        it("returns undefined for NaN", () => {
            expect(getNumberValue(Number.NaN)).toBeUndefined();
        });
        it("parses a numeric string", () => {
            expect(getNumberValue(" 42 ")).toBe(42);
        });
        it("throws for an empty string when strict", () => {
            expect(() => getNumberValue("")).toThrow("Cannot convert empty string to number");
        });
        it("returns undefined for an empty string when lenient", () => {
            expect(getNumberValue("", true)).toBeUndefined();
        });
        it("throws for a non-numeric string when strict", () => {
            expect(() => getNumberValue("abc")).toThrow("Cannot convert value to number");
        });
        it("returns undefined for a non-numeric string when lenient", () => {
            expect(getNumberValue("abc", true)).toBeUndefined();
        });
        it("returns undefined for null/undefined/objects", () => {
            expect(getNumberValue(null)).toBeUndefined();
            expect(getNumberValue(undefined)).toBeUndefined();
            expect(getNumberValue({})).toBeUndefined();
        });
    });

    describe("getStringValue", () => {
        it("returns a non-empty string", () => {
            expect(getStringValue("sku")).toBe("sku");
        });
        it("returns undefined for empty/null/undefined/non-string", () => {
            expect(getStringValue("")).toBeUndefined();
            expect(getStringValue(null)).toBeUndefined();
            expect(getStringValue(undefined)).toBeUndefined();
            expect(getStringValue(123)).toBeUndefined();
        });
    });

    describe("negativeToZero", () => {
        it("clamps negatives to zero and passes through non-negatives", () => {
            expect(negativeToZero(-5)).toBe(0);
            expect(negativeToZero(0)).toBe(0);
            expect(negativeToZero(3)).toBe(3);
        });
    });

    describe("stocksEqual", () => {
        it("is true for identical maps", () => {
            expect(stocksEqual(new Map([[1, 5]]), new Map([[1, 5]]))).toBe(true);
        });
        it("is false for different sizes", () => {
            expect(stocksEqual(new Map([[1, 5]]), new Map())).toBe(false);
        });
        it("is false for same size but different values", () => {
            expect(stocksEqual(new Map([[1, 5]]), new Map([[1, 6]]))).toBe(false);
        });
    });

    describe("computeFinalStocks", () => {
        it("keeps desired values and zeroes current warehouses not covered by desired", () => {
            const current = new Map([[1, 3], [2, 4]]);
            const desired = new Map([[1, 9]]);
            expect([...computeFinalStocks(current, desired).entries()]).toEqual([[1, 9], [2, 0]]);
        });
        it("adds desired warehouses even when absent from current", () => {
            const current = new Map<number, number>();
            const desired = new Map([[2, 7]]);
            expect([...computeFinalStocks(current, desired).entries()]).toEqual([[2, 7]]);
        });
    });

    describe("toStockArray", () => {
        it("omits warehouseId for the main warehouse", () => {
            expect(toStockArray(new Map([[MAIN_WAREHOUSE_ID, 5]]))).toEqual([{ quantity: 5 }]);
        });
        it("includes warehouseId for additional warehouses", () => {
            expect(toStockArray(new Map([[MAIN_WAREHOUSE_ID, 1], [2, 3]]))).toEqual([
                { quantity: 1 },
                { warehouseId: 2, quantity: 3 },
            ]);
        });
    });
});
```

- [ ] **Step 2: Run and confirm green**

```bash
cd stocksprite/processor && npm run test
```

Expected: all new tests pass against the existing `mapping-util.ts` (characterization — no production change).

- [ ] **Step 3: Commit**

```bash
git add processor/test/utils/mapping-util.test.ts
git commit -m "test(processor): cover mapping-util pure functions"
```

---

### Task 4: Processor — `http-util` + `error-util` tests

**Files:**
- Create: `processor/test/utils/http-util.test.ts`
- Create: `processor/test/utils/error-util.test.ts`

**Interfaces:**
- Consumes: `extractErrorMessage(error, fallback = "Request failed")` from `processor/src/utils/http-util.ts`; `stringifyError(error)` from `processor/src/utils/error-util.ts`.

- [ ] **Step 1: Write `http-util.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { extractErrorMessage } from "../../src/utils/http-util.js";

vi.mock("axios", () => ({ default: { isAxiosError: vi.fn() } }));

const isAxiosError = vi.mocked(axios.isAxiosError);

function axiosLikeError(shape: Record<string, unknown>): Error {
    return Object.assign(new Error("boom"), shape);
}

afterEach(() => {
    isAxiosError.mockReset();
    isAxiosError.mockReturnValue(false);
});

describe("http-util.extractErrorMessage", () => {
    it("prefers response.data.error for an axios error", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: { data: { error: "backend says no" } } }))).toBe("backend says no");
    });

    it("prefers response.data.message when error is absent", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: { data: { message: "msg text" } } }))).toBe("msg text");
    });

    it("falls back to HTTP status + message when there is no data body", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: { status: 502 } }))).toBe("HTTP 502: boom");
    });

    it("uses the raw message when there is no response", () => {
        isAxiosError.mockReturnValue(true);
        expect(extractErrorMessage(axiosLikeError({ response: undefined }))).toBe("boom");
    });

    it("uses message for a plain (non-axios) Error", () => {
        expect(extractErrorMessage(new Error("plain"))).toBe("plain");
    });

    it("returns the fallback for unknown values", () => {
        expect(extractErrorMessage("some string")).toBe("Request failed");
    });
});
```

- [ ] **Step 2: Write `error-util.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { stringifyError } from "../../src/utils/error-util.js";

describe("stringifyError", () => {
    it("returns the stack for an Error", () => {
        expect(stringifyError(new Error("boom"))).toContain("boom");
    });
    it("falls back to message when there is no stack", () => {
        const err = new Error("no stack");
        err.stack = undefined;
        expect(stringifyError(err)).toBe("no stack");
    });
    it("JSON-stringifies a plain object", () => {
        expect(stringifyError({ code: "E1" })).toBe('{"code":"E1"}');
    });
    it("handles a circular object via toString", () => {
        const c: Record<string, unknown> = {};
        c.self = c;
        expect(stringifyError(c)).toBe("[object Object]");
    });
    it("returns strings unchanged", () => {
        expect(stringifyError("raw")).toBe("raw");
    });
    it("JSON-stringifies other primitives", () => {
        expect(stringifyError(42)).toBe("42");
        expect(stringifyError(null)).toBe("null");
    });
});
```

- [ ] **Step 3: Run and confirm green**

```bash
cd stocksprite/processor && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add processor/test/utils/http-util.test.ts processor/test/utils/error-util.test.ts
git commit -m "test(processor): cover http-util and error-util"
```

---

### Task 5: Processor — `ConnectionIndexRepository` + `connection-feed.buildIndex`

**Files:**
- Create: `processor/test/repository/connection-index.repository.test.ts`
- Modify: `processor/test/services/connection-feed.service.test.ts` (add one `describe`)

**Interfaces:**
- Consumes: `ConnectionIndexRepository` (`add/get/delete/clear/size/keys`) from `processor/src/repository/connection-index.repository.ts`; `ConnectionFeedService.buildIndex(filePath, mapping)` and the existing `mapping` fixture already defined at the top of `connection-feed.service.test.ts`.

- [ ] **Step 1: Write `connection-index.repository.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { ConnectionIndexRepository } from "../../src/repository/connection-index.repository.js";

describe("ConnectionIndexRepository", () => {
    it("appends duplicate sku states in order", () => {
        const index = new ConnectionIndexRepository();
        index.add("A", new Map([[1, 5]]));
        index.add("A", new Map([[1, 6]]));
        expect(index.get("A")).toHaveLength(2);
        expect([...(index.get("A")?.[1] ?? [])]).toEqual([[1, 6]]);
    });

    it("returns undefined for an unknown sku and deletes correctly", () => {
        const index = new ConnectionIndexRepository();
        expect(index.get("missing")).toBeUndefined();
        index.add("A", new Map([[1, 5]]));
        expect(index.delete("A")).toBe(true);
        expect(index.get("A")).toBeUndefined();
        expect(index.delete("A")).toBe(false);
    });

    it("tracks size, keys, and clear", () => {
        const index = new ConnectionIndexRepository();
        index.add("A", new Map([[1, 1]]));
        index.add("B", new Map([[1, 2]]));
        expect(index.size).toBe(2);
        expect([...index.keys()].sort()).toEqual(["A", "B"]);
        index.clear();
        expect(index.size).toBe(0);
    });
});
```

- [ ] **Step 2: Add a `buildIndex` test to `connection-feed.service.test.ts`**

Add these imports near the top of the existing file (the file already imports `ConnectionIndexRepository`, `RuleTransformService`, `ConnectionFeedService`, and `stubLogger`):

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
```

Then add this `describe` inside the existing `describe("ConnectionFeedService", …)` block (it reuses the existing top-level `mapping` fixture):

```ts
    describe("buildIndex", () => {
        it("streams a semicolon CSV file into the index (BOM-stripped)", async () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-build-"));
            const file = path.join(dir, "feed.csv");
            fs.writeFileSync(file, "SKU;Raktár;BP;Debrecen\nA-100;5;;3\n", "utf-8");

            const index = new ConnectionIndexRepository();
            const service = new ConnectionFeedService(stubLogger(), index, new RuleTransformService());
            const result = await service.buildIndex(file, mapping);

            expect(result.processedItems).toBe(1);
            expect(result.skippedEmptySkus).toBe(0);
            expect(index.size).toBe(1);
            expect([...(index.get("A100")?.[0] ?? [])]).toEqual([
                [1, 5],
                [2, 0],
                [3, 6],
            ]);

            fs.rmSync(dir, { recursive: true, force: true });
        });
    });
```

- [ ] **Step 3: Run and confirm green**

```bash
cd stocksprite/processor && npm run test
```

- [ ] **Step 4: Commit**

```bash
git add processor/test/repository/connection-index.repository.test.ts processor/test/services/connection-feed.service.test.ts
git commit -m "test(processor): cover ConnectionIndexRepository and buildIndex file path"
```

---

### Task 6: Downloader — `commitDownloadedFile`, `encoding-util`, `error-util`

**Files:**
- Modify: `downloader/test/utils/stream-util.test.ts` (append tests)
- Create: `downloader/test/utils/encoding-util.test.ts`
- Create: `downloader/test/utils/error-util.test.ts`

**Interfaces:**
- Consumes: `StreamUtil.commitDownloadedFile(tempFilePath, destinationPath): Promise<boolean>` from `downloader/src/utils/stream-util.ts`; `EncodingUtil.normalizeEncoding(encoding?)` from `downloader/src/utils/encoding-util.ts`; `ErrorUtil.stringifyError(error)` from `downloader/src/utils/error-util.ts`.

- [ ] **Step 1: Append `commitDownloadedFile` tests to `stream-util.test.ts`**

Inside the existing `describe("StreamUtil Unit Tests", …)` block, after the `compareFileHash` test, add:

```ts
  it("commitDownloadedFile reports unchanged when the destination is identical", async () => {
    fs.mkdirSync(testDir, { recursive: true });
    const dest = path.join(testDir, "existing.csv");
    const temp = path.join(testDir, "incoming.tmp");
    fs.writeFileSync(dest, "sku;stock\nA;1\n");
    fs.writeFileSync(temp, "sku;stock\nA;1\n");

    const isUnchanged = await StreamUtil.commitDownloadedFile(temp, dest);

    expect(isUnchanged).toBe(true);
    expect(fs.readFileSync(dest, "utf-8")).toBe("sku;stock\nA;1\n");
    expect(fs.existsSync(temp)).toBe(false);
  });

  it("commitDownloadedFile reports changed and replaces a differing destination", async () => {
    fs.mkdirSync(testDir, { recursive: true });
    const dest = path.join(testDir, "existing.csv");
    const temp = path.join(testDir, "incoming.tmp");
    fs.writeFileSync(dest, "sku;stock\nA;1\n");
    fs.writeFileSync(temp, "sku;stock\nA;2\n");

    const isUnchanged = await StreamUtil.commitDownloadedFile(temp, dest);

    expect(isUnchanged).toBe(false);
    expect(fs.readFileSync(dest, "utf-8")).toBe("sku;stock\nA;2\n");
  });

  it("commitDownloadedFile reports changed when no destination exists yet", async () => {
    fs.mkdirSync(testDir, { recursive: true });
    const dest = path.join(testDir, "new.csv");
    const temp = path.join(testDir, "incoming.tmp");
    fs.writeFileSync(temp, "sku;stock\nA;9\n");

    const isUnchanged = await StreamUtil.commitDownloadedFile(temp, dest);

    expect(isUnchanged).toBe(false);
    expect(fs.readFileSync(dest, "utf-8")).toBe("sku;stock\nA;9\n");
  });
```

- [ ] **Step 2: Write `encoding-util.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { EncodingUtil } from "../../src/utils/encoding-util.js";

describe("EncodingUtil.normalizeEncoding", () => {
    it("defaults to utf-8 when no encoding is given", () => {
        expect(EncodingUtil.normalizeEncoding(undefined)).toBe("utf-8");
        expect(EncodingUtil.normalizeEncoding("")).toBe("utf-8");
    });

    it("normalizes UTF-8 BOM spellings to plain utf-8", () => {
        expect(EncodingUtil.normalizeEncoding("UTF-8-BOM")).toBe("utf-8");
        expect(EncodingUtil.normalizeEncoding("utf8-bom")).toBe("utf-8");
        expect(EncodingUtil.normalizeEncoding("UTF-8 with BOM")).toBe("utf-8");
    });

    it("lowercases and trims any other encoding", () => {
        expect(EncodingUtil.normalizeEncoding(" Windows-1250 ")).toBe("windows-1250");
        expect(EncodingUtil.normalizeEncoding("ISO-8859-2")).toBe("iso-8859-2");
    });
});
```

- [ ] **Step 3: Write `error-util.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ErrorUtil } from "../../src/utils/error-util.js";

describe("ErrorUtil.stringifyError", () => {
    it("returns the stack for an Error", () => {
        expect(ErrorUtil.stringifyError(new Error("boom"))).toContain("boom");
    });

    it("falls back to message when an Error has no stack", () => {
        const err = new Error("no stack");
        err.stack = undefined;
        expect(ErrorUtil.stringifyError(err)).toBe("no stack");
    });

    it("JSON-stringifies a plain object", () => {
        expect(ErrorUtil.stringifyError({ code: "E1" })).toBe('{"code":"E1"}');
    });

    it("falls back to toString for a circular object", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(ErrorUtil.stringifyError(circular)).toBe("[object Object]");
    });

    it("returns a string as-is", () => {
        expect(ErrorUtil.stringifyError("plain")).toBe("plain");
    });

    it("JSON-stringifies non-object, non-error primitives", () => {
        expect(ErrorUtil.stringifyError(42)).toBe("42");
        expect(ErrorUtil.stringifyError(true)).toBe("true");
        expect(ErrorUtil.stringifyError(null)).toBe("null");
    });
});
```

- [ ] **Step 4: Run and confirm green**

```bash
cd stocksprite/downloader && npm run test
```

- [ ] **Step 5: Commit**

```bash
git add downloader/test/utils/stream-util.test.ts downloader/test/utils/encoding-util.test.ts downloader/test/utils/error-util.test.ts
git commit -m "test(downloader): cover commitDownloadedFile, encoding-util, error-util"
```

---

### Task 7: Downloader — `BackendApiClient.getConnectionById` + `reportTestResult`

**Files:**
- Modify: `downloader/test/services/backendApiClient.test.ts` (append tests)

**Interfaces:**
- Consumes: existing `client` fixture (`new BackendApiClient(config, loggerMock)` with `backendUrl: "http://backend:3000"`, `internalToken: "test_token"`) already built in the file's `beforeEach`; `axios` is already `vi.mock("axios")`'d.

- [ ] **Step 1: Append tests to `backendApiClient.test.ts`**

Inside the existing `describe("BackendApiClient Unit Tests", …)` block, add:

```ts
  it("should fetch a single connection by id with the internal token", async () => {
    const conn = {
      id: "conn_1",
      name: "X",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: {},
      dataFormatConfig: {},
      createdAt: "",
      updatedAt: "",
    } as DataConnectionDto;

    vi.mocked(axios.get).mockResolvedValueOnce({ data: { connection: conn } });

    const result = await client.getConnectionById("conn_1");

    expect(result).toEqual(conn);
    expect(axios.get).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/connections/conn_1",
      expect.objectContaining({ headers: { "x-internal-token": "test_token" } })
    );
  });

  it("should throw when a single connection is not found in the response", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

    await expect(client.getConnectionById("missing")).rejects.toThrow("not found in backend response");
  });

  it("should report a test result via PATCH with the internal token", async () => {
    vi.mocked(axios.patch).mockResolvedValueOnce({ status: 200 });

    await client.reportTestResult("conn_1", { progress: "finish" });

    expect(axios.patch).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/connections/conn_1/test-result",
      { progress: "finish" },
      expect.objectContaining({ headers: { "x-internal-token": "test_token" } })
    );
  });

  it("should throw a formatted error when reporting a test result fails", async () => {
    vi.mocked(axios.patch).mockRejectedValueOnce(new Error("net down"));

    await expect(client.reportTestResult("conn_1", { progress: "finish" })).rejects.toThrow(
      "Failed to report test result for 'conn_1'"
    );
  });
```

Note: the existing top-of-file `vi.mock("axios")` auto-mocks `axios.patch` too, so `vi.mocked(axios.patch)` is available with no extra setup.

- [ ] **Step 2: Run and confirm green**

```bash
cd stocksprite/downloader && npm run test
```

- [ ] **Step 3: Commit**

```bash
git add downloader/test/services/backendApiClient.test.ts
git commit -m "test(downloader): cover getConnectionById and reportTestResult"
```

---

### Task 8: Downloader — `SftpDownloader` strategies & auth branches

**Files:**
- Modify: `downloader/test/services/sftpDownloader.test.ts` (append tests)

**Interfaces:**
- Consumes: existing `downloader` fixture (`new SftpDownloader(loggerMock)`) and `testDir` from the file's `beforeEach`; `SftpClient` is already `vi.mock("ssh2-sftp-client")`'d and cast as `SftpClient as unknown as vi.Mock`.

- [ ] **Step 1: Append tests to `sftpDownloader.test.ts`**

Inside the existing `describe("SftpDownloader Unit Tests", …)` block, add:

```ts
  it("should select the most recently modified file for LATEST_MODIFIED strategy", async () => {
    const destFile = path.join(testDir, "latest.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([
        { name: "a.csv", type: "-", size: 100, modifyTime: 1000 },
        { name: "b.csv", type: "-", size: 100, modifyTime: 3000 },
      ]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "sku;stock\n1;2\n");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(() => mockSftpInstance);

    const connection: DataConnectionDto = {
      id: "conn_sftp_mod",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds", fileSelectionStrategy: "LATEST_MODIFIED" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);
    expect(mockSftpInstance.fastGet).toHaveBeenCalledWith("/feeds/b.csv", `${destFile}.tmp`);
  });

  it("should throw when the remote directory has no files", async () => {
    const destFile = path.join(testDir, "empty.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([]),
      fastGet: vi.fn(),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(() => mockSftpInstance);

    const connection: DataConnectionDto = {
      id: "conn_sftp_none",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/empty" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(downloader.download(connection, destFile)).rejects.toThrow("No files found on SFTP server");
  });

  it("should reject an empty (0-byte) downloaded file", async () => {
    const destFile = path.join(testDir, "zero.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([{ name: "empty.csv", type: "-", size: 0, modifyTime: 1 }]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(() => mockSftpInstance);

    const connection: DataConnectionDto = {
      id: "conn_sftp_zero",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expect(downloader.download(connection, destFile)).rejects.toThrow("received empty file (0 bytes)");
  });

  it("should use password auth when credentials.authType is PASSWORD", async () => {
    const destFile = path.join(testDir, "pw.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([{ name: "f.csv", type: "-", size: 1, modifyTime: 1 }]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "x");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(() => mockSftpInstance);

    const connection: DataConnectionDto = {
      id: "conn_sftp_pw",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds" },
      credentials: { authType: "PASSWORD", username: "user", password: "secret" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);
    expect(mockSftpInstance.connect).toHaveBeenCalledWith(
      expect.objectContaining({ username: "user", password: "secret" })
    );
  });

  it("should use the private key raw string for PRIVATE_KEY auth when it is not a file path", async () => {
    const destFile = path.join(testDir, "key.raw.csv");
    const mockSftpInstance = {
      connect: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue([{ name: "f.csv", type: "-", size: 1, modifyTime: 1 }]),
      fastGet: vi.fn().mockImplementation(async (_r: string, local: string) => {
        fs.writeFileSync(local, "x");
      }),
      end: vi.fn().mockResolvedValue(true),
    };
    (SftpClient as unknown as vi.Mock).mockImplementation(() => mockSftpInstance);

    const connection: DataConnectionDto = {
      id: "conn_sftp_key",
      name: "Cromwell",
      channel: "SFTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "SFTP", host: "sftp.example.com", remoteDir: "/feeds" },
      credentials: { authType: "PRIVATE_KEY", username: "user", privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);
    expect(mockSftpInstance.connect).toHaveBeenCalledWith(
      expect.objectContaining({ privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" })
    );
  });
```

- [ ] **Step 2: Run and confirm green**

```bash
cd stocksprite/downloader && npm run test
```

Expected: all new tests pass against the existing `SftpDownloader.ts` (characterization).

- [ ] **Step 3: Commit**

```bash
git add downloader/test/services/sftpDownloader.test.ts
git commit -m "test(downloader): cover SFTP strategies, empty dir, auth branches"
```

---

### Task 9: Downloader — `HttpDownloader` auth & request-config branches

**Files:**
- Modify: `downloader/test/services/httpDownloader.test.ts` (append tests)

**Interfaces:**
- Consumes: existing `downloader` fixture (`new HttpDownloader(loggerMock)`); `axios` is already `vi.mock("axios")`'d, so `vi.mocked(axios)` is the request function and its `mock.calls[0][0]` is the `requestConfig`.

- [ ] **Step 1: Append tests to `httpDownloader.test.ts`**

Inside the existing `describe("HttpDownloader Unit Tests", …)` block, add:

```ts
  it("should set BASIC auth on the request config", async () => {
    const destFile = path.join(testDir, "basic.raw.csv");
    vi.mocked(axios).mockResolvedValueOnce({ data: Readable.from([Buffer.from("a;b\n1;2\n")]), status: 200 });

    const connection: DataConnectionDto = {
      id: "conn_http_basic",
      name: "BasicFeed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/x.csv" },
      credentials: { authType: "BASIC", username: "u", password: "p" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);

    expect(vi.mocked(axios)).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { username: "u", password: "p" } })
    );
  });

  it("should set a Bearer Authorization header", async () => {
    const destFile = path.join(testDir, "bearer.raw.csv");
    vi.mocked(axios).mockResolvedValueOnce({ data: Readable.from([Buffer.from("a;b\n1;2\n")]), status: 200 });

    const connection: DataConnectionDto = {
      id: "conn_http_bearer",
      name: "BearerFeed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/x.csv" },
      credentials: { authType: "BEARER", token: "tok-123" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);

    expect(vi.mocked(axios)).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok-123" }) })
    );
  });

  it("should set a custom API_KEY header", async () => {
    const destFile = path.join(testDir, "apikey.raw.csv");
    vi.mocked(axios).mockResolvedValueOnce({ data: Readable.from([Buffer.from("a;b\n1;2\n")]), status: 200 });

    const connection: DataConnectionDto = {
      id: "conn_http_apikey",
      name: "ApiKeyFeed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/x.csv" },
      credentials: { authType: "API_KEY", headerName: "X-Api-Key", headerValue: "k-9" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);

    expect(vi.mocked(axios)).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ "X-Api-Key": "k-9" }) })
    );
  });

  it("should accept only 2xx status codes and default to GET", async () => {
    const destFile = path.join(testDir, "status.raw.csv");
    vi.mocked(axios).mockResolvedValueOnce({ data: Readable.from([Buffer.from("a;b\n1;2\n")]), status: 200 });

    const connection: DataConnectionDto = {
      id: "conn_http_status",
      name: "StatusFeed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/x.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await downloader.download(connection, destFile);

    const requestConfig = vi.mocked(axios).mock.calls[0][0] as { method: string; validateStatus: (s: number) => boolean };
    expect(requestConfig.method).toBe("GET");
    expect(requestConfig.validateStatus(200)).toBe(true);
    expect(requestConfig.validateStatus(404)).toBe(false);
    expect(requestConfig.validateStatus(500)).toBe(false);
  });
```

- [ ] **Step 2: Run and confirm green**

```bash
cd stocksprite/downloader && npm run test
```

- [ ] **Step 3: Commit**

```bash
git add downloader/test/services/httpDownloader.test.ts
git commit -m "test(downloader): cover HTTP auth branches and status validation"
```

---

## Self-Review

- **Spec coverage:** Every gap identified in the investigation has a task — processor `mapping-util` (Task 3), `http-util`/`error-util` (Task 4), `ConnectionIndexRepository` + `buildIndex` (Task 5), downloader `commitDownloadedFile`/`encoding-util`/`error-util` (Task 6), `getConnectionById`/`reportTestResult` (Task 7), SFTP strategies/auth (Task 8), HTTP auth/status (Task 9). The two refactor concerns (split integration; unify layout on `test/`) are Tasks 1–2.
- **Placeholder scan:** All test steps contain complete code; no "TBD"/"add validation"/"similar to Task N".
- **Type consistency:** `stubLogger(overrides?)` is defined once (Task 1) and imported as `stubLogger` everywhere; `MAIN_WAREHOUSE_ID`, `computeFinalStocks`, `getNumberValue`, etc. match `mapping-util.ts` exactly; downloader fixtures use the `DataConnectionDto` shape already in use in those test files.
- **Path consistency:** every `tests/` reference was replaced with `test/`; the downloader's `test-integration.ts` file remains excluded from `npm run test` by its non-`.test.ts` name, while the processor's `*.test.ts` integration file is excluded via the explicit `exclude` glob in `vitest.config.ts`.

**Deliberate non-goals (out of scope):** adding `vitest-mock-extended` to the processor (or removing it from the downloader); testing `CliUtil.executeCommand` and the downloader's `csvformat` CLI path (both require a real subprocess); testing `DownloaderService`/`ConverterFactory`/`DownloaderFactory` unsupported-channel throws (low value, would require asserting on a switch's default). Each can be added later as a follow-up.
