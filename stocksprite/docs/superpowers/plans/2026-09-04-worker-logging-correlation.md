# Worker Logging Correlation Plan (processor + downloader)

> **Status:** DESIGN — not yet approved for implementation. All open decisions are resolved (see
> [Open decisions](#open-decisions)); no code edits until the plan is approved.
>
> **For agentic workers:** REQUIRED SUB-SKILL when executing: use
> superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Make every log line emitted by the two ephemeral worker services (`processor`,
`downloader`) carry the run/mapping/connection correlation ids it needs so DevOps can trace a
run in Cloud Logging / OpenSearch by run, mapping, user, or connection — without storing any
human connection *name* and without repeating the ids in `context`.

**Architecture:** Both workers already emit single-line JSON via a per-project `log4js` layout
(`jsonWithDataFieldLayout`). Because each job runs one unit of work per process and the
downloader + processor **share one container** (same global env), the layout reads the
correlation ids from process env at startup and stamps them once into a nested **`correlation`
object** on **every** line — guaranteeing 100% coverage (including future log calls and
leaf-service logs that carry no id in their code) with zero per-callsite edits.

**Tech Stack:** TypeScript, `log4js`, Vitest 4, inversify. Existing, unchanged.

**Scope boundaries:**
- In scope (this plan): the two worker `log4js.config.ts` layouts; **de-duplication edits** to
  worker log callsites that currently repeat run-level ids in `context`; and a small
  storesprite-be change so connection-test (`runTest`) runs also export `CONNECTION_ID`
  (mapping-run dispatch already does — verified 2026-09-04, see O1/O2, F8 and Task 1). Live
  verification.
- **Explicitly rejected:** storing the human connection *name* in logs (see Decision D2).
  Whether the downloader should be *scoped* to one connection per run is out of scope (see
  Risk "downloader full mode").

---

## Confirmed facts (observed, not assumed)

- **F1 — Logging shape today:** Both workers emit single-line JSON via a duplicated layout
  named `jsonWithDataFieldLayout`:
  - `stocksprite/processor/src/config/log4js.config.ts` — category `processor`, console only.
  - `stocksprite/downloader/src/config/log4js.config.ts` — category `downloader`, stdout +
    rotating file (`<outputDir>/downloader.log`). Layout duplicated intentionally (separate
    deploys; no shared package).
  - Entry shape: `{ ts, level, category, msg, context }`; `context` = the 2nd logger arg.
  - Multi-line error stacks are JSON-escaped onto one physical line. Verified live.
- **F2 — Worker/process topology:** Each container runs exactly one job. The `processor` is
  spawned per mapping-history run and reads `MAPPING_ID`, `RUN_ID` (+ `INTERNAL_TOKEN`,
  `BACKEND_URL`, `OUTPUT_DIR`) from env (`getAppConfig()` throws if `MAPPING_ID`/`RUN_ID`
  missing). The `downloader` reads `USER_ID` (+ `OUTPUT_DIR`, …).
- **F3 — Shared container env:** The `downloader` and `processor` commands run in the **same
  Docker container**, so both processes see the same container-level env. Therefore the
  downloader *can* read `MAPPING_ID`/`RUN_ID`/`CONNECTION_ID` too (they are not downloader-only
  vars). [User-confirmed]
- **F4 — Processor connection id:** `GET /mappings/:id/run-config` returns
  `{ mapping: { id, connectionId, skuField, stockMappings }, unasConfig, warehouses }`
  (`MappingDto`). It carries `connectionId` but **no human connection name** and **no
  `connectionName`** field. Schema at `src/config/run-config.schema.ts`.
- **F5 — Downloader connection id:** `DataConnectionDto` has `id`, `name`, … ; downloader log
  and result code carries `connection.id` (+ `name`, `channel`, `dataFormat`).
- **F6 — Env-driven correlation is the transport:** workers bootstrap all config from env and
  already throw on missing required vars, so reading additional optional ids from env is the
  established pattern.
- **F7 — Verification environment:** tests/build/lint/install run in-container only via
  `docker exec` into `stocksprite-dev` (never host Node). Integration suite for the downloader
  is heavy (builds an image + compose mocks) and is run on request.
- **F8 — Orchestrator env reality (confirmed from code 2026-09-04):** The orchestrator is
  `storesprite-be/src/services/stocksprite/ConnectionTestRunnerService.ts`, which runs the
  combined worker container via `docker run`. Mapping runs already export `MAPPING_ID`,
  `RUN_ID`, `USER_ID` (+ `INTERNAL_TOKEN`, `BACKEND_URL`, `OUTPUT_DIR`); connection tests
  export `TEST_CONNECTION`, `USER_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`. **Mapping runs already
  export `CONNECTION_ID`** (first entry of the `runMapping` env payload); **`runTest` does not** —
  adding it there is the only remaining backend gap (Task 1). The **only live mapping-run dispatch
  site** is `SchedulerService._dispatchMappingRun` → `_runner.runMapping(...)`; the manual
  "Run now" path (`MappingService.runMapping`, invoked from `mappingsApi.ts`) is currently a
  stub that never dispatches a container. `Mapping` is a MikroORM `@ManyToOne` owning the FK,
  so `mapping.connection?.id` is readable synchronously without a lazy-load.
- **F9 — Single-connection model (user domain, confirmed 2026-09-04):** the worker container is
  assigned **exactly one connection** per run — the connection of the mapping being processed.
  A connection defines how to access the data source to download; a mapping defines how to map
  that source's columns to UNAS product fields; downloader and processor always act on the
  **same** mapping/connection. Therefore `connectionId` is a run-level constant — exactly like
  `mappingId`/`runId`/`userId` — and is *not* per-line data.

## Decisions made

- **D1 — Stamp correlation ids at the layout layer** (process env → a `correlation` object on
  every line), not by threading a context through every service and hand-adding to ~60
  callsites. Guarantees all logs incl. future ones. [User-implied; no objection raised]
- **D2 — No `CONNECTION_NAME` env / no human name in logs.** Connection identification is by
  `connectionId` only. Rationale (user-led): the id is the stable, short, unique key; names are
  user-editable (drift over time → less reliable in historical logs), up to 255 chars, repeated
  per line wastes storage, and add complexity. [User-confirmed]
- **D3 — No separate human-name "session start … connection X" log.** The run/mapping/user/
  connection ids are on every line in `correlation`. An id-based marker line is **not** added
  (O4 resolved 2026-09-04). [User-led]
- **D4 — Correlation ids grouped in ONE nested `correlation` object, not flat top-level fields
  and not inside `context`.** Target: `{ ts, level, category, correlation, msg, context }`.
  Chosen for readability-at-a-glance on each log line. OpenSearch still filters nested fields
  via dotted path (`correlation.mappingId`); this is a plain `object`, not a `nested` datatype.
  [User-confirmed 2026-09-04]
- **D5 — `correlation` is always emitted as a fixed four-key object; an unset env var yields
  `null`.** `{ mappingId, runId, connectionId, userId }` in that order, each field `null` when
  its env var is missing/empty — never omitted, never `undefined` (matches the target shapes;
  OpenSearch sees `null`, not a missing field). The `msg`/`context` behavior is unchanged.
  [O5 resolved 2026-09-04, user-confirmed]
- **D6 — No duplicate run-level ids in `context`.** Because `correlation` stamps the run-level
  ids on every line, every existing log callsite that repeats `mappingId`/`runId`/`userId`/
  `connectionId` in its `context` drops those keys (single-connection model ⇒ `connectionId` is
  run-level, so it is dropped there too). `context` keeps only genuinely per-line data
  (counters, counts, file paths, host, errors, …; the human connection `name` is dropped too —
  D2). Business result objects (`results.push({ connectionId, … })`) are NOT log contexts and
  stay untouched. [User-confirmed 2026-09-04]

### Logging contract (added 2026-09-04; governs every worker log line)

- **`correlation` is stamped seamlessly.** The layout adds the `correlation` object to every
  line (from process env at startup); callers never set it.
- **Correlation data is never repeated in `context`.** An id carried by
  `correlation.mappingId`/`runId`/`connectionId`/`userId` must not also appear as a `context`
  key (D6).
- **`msg` may carry light inline data, but `context` is the primary structured data** of the
  entry — put machine-readable values there under meaningful property names, not in prose.
- **`msg` is a meaningful, clear, descriptive human text** about the event.
- **Log info / warn / error events that are meaningful in the code.**
- **Exception-raised error entries carry the full exception text** in `context.error` — the
  stringified message + stack (existing `stringifyError` form kept as a string; no structured
  error object). [User-confirmed 2026-09-04]

### Env contract

| `correlation` field | Env var read | processor | downloader |
|---|---|---|---|
| `correlation.mappingId` | `MAPPING_ID` | ✅ (required env) | ✅ (shared container) |
| `correlation.runId` | `RUN_ID` | ✅ (required env) | ✅ (shared container) |
| `correlation.connectionId` | `CONNECTION_ID` | ✅ runMapping exports it (F8) | ✅ runMapping exports it (F8); runTest adds it (Task 1) |
| `correlation.userId` | `USER_ID` | ✅ (null when unset) | ✅ (null when unset) |

`correlation` is **always** emitted with all four fields; a field is `null` when its env var is
missing/empty — never omitted, never `undefined` (D5 / O5 resolved 2026-09-04).

Target per-line shapes — **identical for both workers** [User-confirmed 2026-09-04]:
- processor: `{ ts, level, category, correlation: { mappingId, runId, connectionId, userId }, msg, context }`
- downloader: `{ ts, level, category, correlation: { mappingId, runId, connectionId, userId }, msg, context }`

## Open decisions (all resolved 2026-09-04 — recorded for traceability)

- **O1 — [RESOLVED 2026-09-04] Env var names confirmed by code.** `MAPPING_ID`, `RUN_ID`,
  `USER_ID` are exactly the names the orchestrator already exports for mapping runs — no worker
  read-name change needed. `CONNECTION_ID` is exported by `runMapping` but **not yet by
  `runTest`**; adding it there is the in-scope backend Task 1. (Details in F8.)
- **O2 — [RESOLVED 2026-09-04] Who exports `CONNECTION_ID`.** The orchestrator
  (storesprite-be, `ConnectionTestRunnerService`) **will** pass the connection id as container
  env `CONNECTION_ID` to the worker. [User-confirmed 2026-09-04] In scope as Task 1 (backend).
  Connection-test mode additionally gains `CONNECTION_ID` (keeps `TEST_CONNECTION` as its mode
  signal). The workers only *read* the var; when absent the field is `null` (D5/O5).
- **O3 — [RESOLVED] Which workers stamp `userId`?** **Both** — processor and downloader emit an
  identical `correlation.userId` (`null` when `USER_ID` is unset, per D5/O5). [User-confirmed 2026-09-04]
- **O4 — [RESOLVED 2026-09-04] No separate "run started" marker line.** `correlation` on every
  line is sufficient (D3). Task "marker line" is therefore a no-op and has been removed from the
  task list.
- **O5 — [RESOLVED 2026-09-04] Always emit the fixed four-key `correlation` object**, each field
  `null` when its env var is unset (matches the target shapes below; OpenSearch sees `null`,
  never a missing field). Recorded in D5. [User-confirmed]

## Design

### Layout change (both `log4js.config.ts` files)

1. Read the four ids from `process.env` at configure time: the snapshot lives inside the layout
   factory, which log4js runs during `configure()` — at startup, before any log line. The per-line
   function returned by the factory reuses that one snapshot object, so `correlation` is fixed for
   the process lifetime (read once, not per log line). Trim each value; an empty/missing var
   becomes `null`. Build order: `mappingId`, `runId`, `connectionId`, `userId`.
2. Emit `correlation` **on every line, always with all four fields** (D5/O5) — insert it between
   `category` and `msg`: `{ ts, level, category, correlation, msg, context }`.
3. Leave `msg`/`context` handling byte-identical to today (message text = `data[0]`; `context`
   = `data[1]` when a plain object). `context` is unchanged by the layout — de-duplication
   happens at the callsites (D6).
4. Do **not** change categories (`processor` / `downloader`), appender topology, LOG_LEVEL
   handling, or `getLogger` defaults.

Exact implementation — **identical in both `log4js.config.ts` files** (both are 4-space
indented today; the only differences between the files stay in `configureLogger` — return type,
appenders, categories — the layout below is byte-identical). Replace the existing
`jsonWithDataFieldLayout` function in each file with the code below (it adds a `readCorrelation`
helper directly above the layout function):

```ts
/** Read once at configure time. Fixed four-key object; unset env vars become null (D5/O5). */
function readCorrelation(): Record<string, string | null> {
    return {
        mappingId: process.env.MAPPING_ID?.trim() || null,
        runId: process.env.RUN_ID?.trim() || null,
        connectionId: process.env.CONNECTION_ID?.trim() || null,
        userId: process.env.USER_ID?.trim() || null,
    };
}

export function jsonWithDataFieldLayout(): (logEvent: LoggingEvent) => string {
    const correlation = readCorrelation();
    return (logEvent: LoggingEvent): string => {
        // log4js types logEvent.data as `any[]`, so every read is `any`. The strict
        // no-unsafe-assignment rule is noise here: we deliberately forward the raw
        // payload to JSON, and the runtime shape of each cell is validated below.
        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        const rawMessage = logEvent.data[0];
        const entry: Record<string, unknown> = {
            ts: new Date(logEvent.startTime).toISOString(),
            level: logEvent.level.levelStr,
            category: logEvent.categoryName,
            correlation,
            msg: typeof rawMessage === "string" ? rawMessage : "",
        };
        const extra = logEvent.data[1];
        if (extra !== null && typeof extra === "object" && !Array.isArray(extra)) {
            entry.context = extra;
        }
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
        return JSON.stringify(entry);
    };
}
```

No business/service *logic* changes are needed for D1 (stamping is layout-level). The D6
callsite edits below only remove now-redundant keys from log `context` objects.

## Tasks

### Task 1 — Backend (storesprite-be): export `CONNECTION_ID` in `runTest`

Mapping-run dispatch **already** threads the connection id through and exports `CONNECTION_ID`
(committed; see F8). The only missing piece is connection-test mode: `runTest` does not set
`CONNECTION_ID` in its container env, so a downloader connection-test run has no
`correlation.connectionId`.

**Already in place (verified 2026-09-04 — verify only, do NOT re-edit):**
- `ConnectionTestRunnerService.interface.ts` — `runMapping(connectionId, mappingId, runId,
  userId, token, backendUrl)` and `runTest(connectionId, userId, token, backendUrl)` both
  already declare `connectionId`.
- `ConnectionTestRunnerService.ts` `runMapping` env payload (~lines 84-92) already includes
  `CONNECTION_ID: connectionId` as its first entry.
- `SchedulerService.ts` (line ~104) already calls `runMapping(mapping.connection.id,
  mapping.id, run.id, userId, token, backendUrl)`.
- `Mapping.connection` is a `@ManyToOne` owning the FK, so `mapping.connection?.id` is read
  synchronously. The manual Run-now path (`MappingService.runMapping`) is a stub that never
  dispatches a container — no change there.

**Files:**
- Modify: `storesprite-be/src/services/stocksprite/ConnectionTestRunnerService.ts` (runTest env only)
- Modify: `storesprite-be/tests/unit/services/stocksprite/connectionTestRunnerService.test.ts` (runTest env assertion)

- [ ] **Step 1 — Add `CONNECTION_ID` to the `runTest` env payload.** In
  `ConnectionTestRunnerService.runTest` (~lines 47-52), add `CONNECTION_ID: connectionId` as the
  **first** entry of the `_runContainer` env object (match `runMapping`'s ordering). Keep
  `TEST_CONNECTION` — it is the connection-test mode signal the worker switches on.
- [ ] **Step 2 — Update the `runTest` unit assertion.** In
  `connectionTestRunnerService.test.ts` ("runTest: spawns docker run with the connection-test
  environment", ~lines 135-144), add `"-e", "CONNECTION_ID=conn9"` as the first two entries of
  the expected env array. The runMapping env/signature assertions already pass — do not touch
  them.
- [ ] **Step 3 — Verify.** Run in container:
  `MSYS_NO_PATHCONV=1 docker exec storesprite-be sh -c 'cd /workspace/storesprite-be && npm test && npm run build && npm run lint'`
  Expect all green (backend unit suite currently passes ~135 tests).

> Note: `MappingService.runMapping` (manual "Run now", `mappingsApi.ts`) is a stub that never
> dispatches a container — no change there now; when it is wired it must pass the connection id
> too.

### Task 2 — Processor: stamp `correlation` + drop redundant ids from `context`

**Files:**
- Modify: `stocksprite/processor/src/config/log4js.config.ts` (layout change above).
- Modify: `stocksprite/processor/src/index.ts`
- Modify: `stocksprite/processor/src/services/processor.service.ts`
- Modify: `stocksprite/processor/src/services/backend-api-client.ts`

- [ ] **Step 1 — Layout:** implement the `correlation` snapshot + insertion in
  `log4js.config.ts` (Design above). Ids read from `MAPPING_ID`, `RUN_ID`, `CONNECTION_ID`,
  `USER_ID`.
- [ ] **Step 2 — `index.ts` de-dup** (`processor/src/index.ts`): the three log contexts lose the
  ids —
  `logger.info("Stock processor starting", { mappingId, runId })` → `logger.info("Stock processor starting")`;
  `logger.info("Stock processor exiting", { mappingId, runId, exitCode })` → `{ exitCode }`;
  `logger.error("Fatal error during processor startup", { mappingId, runId, error: message })` → `{ error: message }`.
  Then delete the now-unused `let mappingId: string | undefined;` / `let runId: string |
  undefined;` locals and the `const config = container.get<AppConfig>(TYPES.AppConfig);` +
  `mappingId = config.mappingId;` + `runId = config.runId;` lines, and remove the
  `import type { AppConfig } from "./config/app.config.js";`. `TYPES` stays (still used for
  `TYPES.Logger`).
- [ ] **Step 3 — `processor.service.ts` de-dup** (keep logic vars `mappingId`/`runId` — they
  are still passed to `reportProgress`):
  - "Stock processor run started" → msg only.
  - "Run configuration fetched" → `{ warehouseCount }` (drop `connectionId: mapping.connectionId`).
  - "Supplier feed is empty; nothing to process" → `{ processedItems }`.
  - "Stock processor run finished" → `{ ...counters }`.
  - "Stock processor run failed" → `{ error: message }`.
  - "Failed to report the run error back to the backend" → `{ runError: message, error }`.
- [ ] **Step 4 — `backend-api-client.ts` de-dup** (keep `mappingId` as a method param — it is
  used in the URL/body):
  - "Fetching run configuration from backend" → `{ url }`.
  - "Run configuration failed Ajv validation" → `{ detail }`.
  - "Failed to fetch run configuration" → `{ error: message }`.
  - "Reported progress to backend" → `{ progress: body.progress }`.
  - "Failed to report progress" → `{ progress: body.progress, error: message }`.
- [ ] **Step 5 — Verify + smoke.** Run:
  `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/processor && npm run build && npm run lint && npm test'`
  **No processor unit-test edits are needed** — no processor test asserts logger args (verified
  2026-09-04). Smoke — expect every stdout line to carry the full correlation object and no id
  key inside `context`:
  `MSYS_NO_PATHCONV=1 docker exec -e MAPPING_ID=map1 -e RUN_ID=run1 -e CONNECTION_ID=conn1 -e USER_ID=u1 -e INTERNAL_TOKEN=tok -e BACKEND_URL=http://127.0.0.1:1 stocksprite-dev sh -c 'cd /workspace/stocksprite/processor && npm run build >/dev/null && node dist/index.js'`
  (`BACKEND_URL=http://127.0.0.1:1` fails fast after the startup lines.) Expected shape on each
  line: `"correlation":{"mappingId":"map1","runId":"run1","connectionId":"conn1","userId":"u1"}`
  and no `mappingId`/`runId`/`connectionId`/`userId` key inside `context`.

### Task 3 — Downloader: stamp `correlation` + drop redundant ids from `context`

**Files:**
- Modify: `stocksprite/downloader/src/config/log4js.config.ts` (layout change above).
- Modify: `stocksprite/downloader/src/index.ts`
- Modify: `stocksprite/downloader/src/services/downloader-service.ts`
- Modify: `stocksprite/downloader/src/services/backend-api-client.ts`
- Modify: `stocksprite/downloader/src/services/xml-converter.ts`
- Modify: `stocksprite/downloader/src/services/csv-converter.ts`
- Modify: `stocksprite/downloader/src/services/http-downloader.ts`
- Modify: `stocksprite/downloader/src/services/sftp-downloader.ts`

- [ ] **Step 1 — Layout:** implement the `correlation` snapshot + insertion in
  `log4js.config.ts` (Design above). Ids read from `MAPPING_ID`, `RUN_ID`, `CONNECTION_ID`,
  `USER_ID`.
- [ ] **Step 2 — `index.ts` de-dup** (`downloader/src/index.ts`): the four log contexts lose the
  `userId` id —
  `logger.info("Initializing StoreSprite Downloader Service", { userId })` → `logger.info("Initializing StoreSprite Downloader Service")`;
  `logger.warn("Downloader finished with errors", { userId, successCount, errorCount })` →
  `{ successCount, errorCount }`;
  `logger.info("Downloader completed successfully without errors", { userId })` → `logger.info("Downloader completed successfully without errors")`;
  `logger.error("Fatal exception during downloader execution", { userId, error: errorMsg })` →
  `{ error: errorMsg }`.
  Then delete the now-unused `let userId: string | undefined;` local, the
  `const config = container.get<AppConfig>(TYPES.AppConfig);` + `userId = config.userId;` lines,
  and remove the `import type { AppConfig } from "./config/app.config.js";`. `TYPES` stays
  (still used for `TYPES.Logger` and `TYPES.IDownloaderService`).
- [ ] **Step 3 — `downloader-service.ts` de-dup** (single-connection code — no full mode). Drop
  the run-level ids (`connectionId`, `userId`, and where present `mappingId`/`runId`) AND the
  human `name` from log contexts per D2 — connection identity is `correlation.connectionId`
  only. Every affected callsite → target:
  - Mapping-run mode: "Starting Downloader session (single-connection mapping run)"
    `{ userId, connectionId, outputDir, backendUrl }` → `{ outputDir, backendUrl }`; "Fetched
    connection for mapping run" `{ connectionId, name, channel, dataFormat }` →
    `{ channel, dataFormat }`; `` `Successfully processed connection '${connectionName}'
    [ID: ${connectionId}]` `` → static `"Successfully processed connection"`, context
    `{ csvFilePath, isUnchanged }` (audit #1); `` `Error processing connection
    '${connectionName}' [ID: ${connectionId}]` `` → static `"Error processing connection"`,
    context `{ error: errorMsg }` (audit #2, also drops the `name` key); "Failed to report
    mapping run error to backend" `{ mappingId, runId, error }` → `{ error }`; "Mapping run
    identity missing; skipping run-error report" `{ mappingId, runId }` → msg only.
  - Test mode: "Executing single connection test mode" `{ connectionId, userId }` → msg only;
    "Connection test completed successfully" `{ connectionId, rowCount, columnCount,
    durationMs }` → `{ rowCount, columnCount, durationMs }`; "Connection test failed"
    `{ connectionId, error: errorMsg }` → `{ error: errorMsg }`; "Failed to report test failure
    to backend" `{ connectionId, error }` → `{ error }`.
  - Leave unchanged: "Downloader session aborted" (context is only `{ error: errorMsg }`); the
    thrown `Connection '${connectionId}' is not active …` error is id-based (no human name).
  - Keep the business `results.push({ connectionId, name: connectionName, … })` objects in
    **both** modes (mapping-run ~lines 108/152, test-mode ~243/283) and the `connectionName`
    local — results/data are not log contexts (D6 exemption).
- [ ] **Step 4 — Leaf services de-dup** (`xml-converter.ts`, `csv-converter.ts`,
  `http-downloader.ts`, `sftp-downloader.ts`): remove the id/name keys from every logger
  `context`. Rule: **drop only `connectionId: connection.id` and `name: connection.name`; keep
  every other key as-is** (xml-converter contexts never logged `name`). The three "…content is
  identical to existing file on disk (unchanged)" lines become msg only. Reword the thrown-Error
  strings that embed `'${connection.name}'` — exactly three, all rewritten to embed the
  connection id instead: `http-downloader.ts` HTML-response error (`HTTP response for '…'
  returned an HTML web page…`), `http-downloader.ts` empty-response error, `sftp-downloader.ts`
  empty-file error. Current → target per callsite:

  | Service | `msg` (current) | `context` current → target |
  |---|---|---|
  | http | "Starting HTTP download" | `{ connectionId, name, url }` → `{ url }` |
  | http | "Downloaded content is identical to existing file on disk (unchanged)" | `{ connectionId, name }` → msg only |
  | http | "HTTP download completed successfully" | `{ connectionId, name, destinationPath, byteCount, isUnchanged }` → `{ destinationPath, byteCount, isUnchanged }` |
  | http | "HTTP download failed" | `{ connectionId, name, error: errorMsg }` → `{ error: errorMsg }` |
  | sftp | "Starting SFTP download" | `{ connectionId, name, host, remoteDir }` → `{ host, remoteDir }` |
  | sftp | "Selected remote SFTP file for download" | `{ connectionId, remoteFilePath, fileSize }` → `{ remoteFilePath, fileSize }` |
  | sftp | "SFTP downloaded content is identical to existing file on disk (unchanged)" | `{ connectionId, name }` → msg only |
  | sftp | "SFTP download completed successfully" | `{ connectionId, name, destinationPath, byteCount, isUnchanged }` → `{ destinationPath, byteCount, isUnchanged }` |
  | sftp | "SFTP download failed" | `{ connectionId, name, error: errorMsg }` → `{ error: errorMsg }` |
  | xml | "Converting raw XML to standardized CSV format via SAX stream" | `{ connectionId, inputRawPath, outputCsvPath, targetRowTag, encoding }` → drop `connectionId` |
  | xml | "XML to CSV conversion finished successfully" | `{ connectionId, outputCsvPath, rowCount, byteCount }` → drop `connectionId` |
  | csv | "Converting raw CSV to standardized format" | `{ connectionId, inputRawPath, outputCsvPath, inputDelimiter, encoding, targetDelimiter }` → drop `connectionId` (**keep** `inputDelimiter`, `targetDelimiter`) |
  | csv | "csvformat CLI conversion failed or tool not found, falling back to streaming CSV converter" | `{ connectionId, error }` → `{ error }` |
  | csv | "CSV conversion finished via `${mode}`" | `{ connectionId, outputCsvPath, byteCount }` → `{ outputCsvPath, byteCount }` |

  Extra cleanup in `csv-converter.ts`: `_finalize(outputCsvPath, connectionId, mode)` exists
  only to log `connectionId` — remove the `connectionId` parameter (now unused) and update its
  two call sites from `this._finalize(outputCsvPath, connection.id, "csvformat CLI")` /
  `this._finalize(outputCsvPath, connection.id, "stream fallback")` to
  `this._finalize(outputCsvPath, "csvformat CLI")` / `this._finalize(outputCsvPath, "stream
  fallback")`. The services still receive `connection` and use `connection.id` in file paths —
  only the log contexts and the three error texts change.
- [ ] **Step 5 — `backend-api-client.ts` de-dup — all six log contexts.** Drop the run-level ids
  (`connectionId` on the connection/test methods, plus `mappingId`/`runId` on the run-error
  methods); keep per-line `url` and `error`/`progress`:
  - "Fetching single connection from backend" `{ connectionId, url }` → `{ url }`.
  - "Failed to fetch connection from backend" `{ connectionId, url, error: errorMsg }` → `{ url, error: errorMsg }`.
  - "Reporting test result to backend" `{ connectionId, progress: result.progress }` → `{ progress: result.progress }`.
  - "Failed to report test result to backend" `{ connectionId, url, error: errorMsg }` → `{ url, error: errorMsg }`.
  - "Reporting mapping run error to backend" `{ mappingId, runId, url }` → `{ url }`.
  - "Failed to report mapping run error to backend" `{ mappingId, runId, url, error: errorMsg }` → `{ url, error: errorMsg }`.
  `connectionId`/`mappingId`/`runId` stay as method parameters (used in URL/body) — only the log
  contexts lose them.
- [ ] **Step 6 — Verify + smoke.** Run:
  `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm run build && npm run lint && npm test'`
  **Unit-test edits needed — exactly five assertions (verified 2026-09-04):**
  - `test/services/downloader-service.test.ts:204-207` → the expected 2nd arg
    `{ mappingId: undefined, runId: undefined }` on `loggerMock.warn` is removed (msg-only call).
  - `test/services/downloader-service.test.ts:223-226` → `objectContaining({ mappingId: "map_1",
    runId: "run_1" })` becomes `objectContaining({ error: expect.any(String) })`.
  - `test/services/csv-converter-cli.test.ts:74-77`, `:91-94`, `:95-98` → drop
    `connectionId: "conn_csv"` from each `objectContaining`.
  The downloader integration suite's stdout substring asserts (`:275`, `:311`, `:312`) stay
  green — the message text is unchanged. Smoke (mapping-run): expect init/connection/error lines
  to carry the correlation object with no id key inside `context`:
  `MSYS_NO_PATHCONV=1 docker exec -e USER_ID=u1 -e CONNECTION_ID=conn1 -e MAPPING_ID=map1 -e RUN_ID=run1 -e INTERNAL_TOKEN=tok -e BACKEND_URL=http://127.0.0.1:1 stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm run build >/dev/null && node dist/index.js'`
  Expected on each line:
  `"correlation":{"mappingId":"map1","runId":"run1","connectionId":"conn1","userId":"u1"}`.
  Test-mode smoke (optional): replace the env with `USER_ID=u1 TEST_CONNECTION=conn1
  CONNECTION_ID=conn1` and drop `MAPPING_ID`/`RUN_ID` — expect `correlation.mappingId`/`runId`
  to be `null` (D5/O5).

#### Message/context duplication audit (added 2026-09-04)

Audited every logger call in both workers for the anti-pattern where the **same value** is
interpolated into the human-readable `msg` **and** repeated in that call's `context`. Only two
downloader callsites do it; the processor has none (all its messages are static). These are to be
refactored so the `msg` stops carrying data that lives structured in `context`/`correlation`
(target below follows D6 for the run-level ids and D2/Interpretation A for the human name —
confirmed in conversation 2026-09-04: logs identify the connection by `correlation.connectionId`
only).

| # | Callsite (current) | `msg` carries inline | `context` carries | Refactor target |
|---|---|---|---|---|
| 1 | `stocksprite/downloader/src/services/downloader-service.ts:94-96` | `connectionName`, `connectionId` (`[ID: …]`) | `connectionId`, `csvFilePath`, `isUnchanged` | Static `msg` `"Successfully processed connection"` (drop `'…name…'` and `[ID: …]`). `connectionId` leaves `context` (stamped as `correlation.connectionId`). Keep `{ csvFilePath, isUnchanged }`. |
| 2 | `stocksprite/downloader/src/services/downloader-service.ts:120-124` | `connectionName`, `connectionId` (`[ID: …]`) | `connectionId`, `name`, `error` | Static `msg` `"Error processing connection"` (drop `'…name…'` and `[ID: …]`). Drop `name` (D2/Interpretation A) and `connectionId` (→ `correlation.connectionId`). Keep `{ error }`. |

Not msg/context duplications (the `msg`-inline value appears only in `msg`, not also in
`context`) — their **msg text** stays as-is: `csv-converter.ts:70` `CSV conversion finished via
${mode}`, and `unas-product-db.service.ts:65` main-stock column-name constant. Being a
non-duplication does NOT exempt `csv-converter.ts:70` from Step 4: `mode` remains inline in the
message, but its `context` still drops `connectionId` (D6 — see Step 4 table).

> Note: this audit + the Step 3/4 rewording above supersede the earlier "keep `name`" phrasing —
> the human connection name is dropped from all downloader log `context`s and `msg` text (D2,
> Interpretation A, confirmed 2026-09-04).

### Task 4 — Docs: update the log-field-shape references (definite — both enumerate fields)

- **`CONSTITUTION.md` §5.1 ("Logging & Observability Invariants", ~lines 169-176):** the entry
  field bullet list (`ts`/`level`/`category`/`msg`/`context`) gains a `correlation` bullet
  (`{ mappingId, runId, connectionId, userId }`, `null` when an env var is unset); the `context`
  example "(e.g. `sku`, `userId`, `error`, `url`)" drops `userId` (run-level ids now live only
  in `correlation` — D6/D2).
- **`stocksprite/readme.md`:** line ~9 "(plus `USER_ID` for context/logging)" → reword to "and
  `USER_ID` (logged as `correlation.userId`)"; line ~20 `{ ts, level, category, msg, context }`
  → `{ ts, level, category, correlation, msg, context }`.
- No per-worker readmes exist — do not invent file paths.

## Global constraints (verbatim from prior approved migration work; applies to any edit)

- **Commit only when the user asks.** No commit steps in tasks.
- **Tests/builds/lint run in-container only** via `docker exec stocksprite-dev` — never host
  Node.
- Git edits on host; each project has its own `package.json`/`package-lock.json`; no dependency
  changes are expected here (layout + log-context edits only) — if any dep is needed, run
  `npm install` in that project's container.

## Risks / notes

- **Downloader "full mode" (historical) is gone — verified 2026-09-04.**
  `downloader-service.run()` is single-connection: test mode when `TEST_CONNECTION` is set,
  otherwise it requires `CONNECTION_ID` and processes that one connection (F9). There is no path
  that loops every connection of the user; no behavior change is needed or in scope here.
- The two `jsonWithDataFieldLayout` copies must be kept in sync manually (D-free choice,
  documented). If drift becomes an issue, extracting a shared layout package is a follow-up.
- `correlation.connectionId` is `null` until `CONNECTION_ID` reaches the worker: mapping runs
  already export it; `runTest` gains it in Task 1. Until Task 1 ships, connection-test runs log
  `correlation.connectionId: null` (D5/O5) — behavior is otherwise unchanged.
- Downloader keeps its file appender (stdout + `<outputDir>/downloader.log`); not changing it.
- The downloader integration suite asserts on stdout *message* substrings (e.g.
  "Error processing connection"), which survive inside JSON `msg`; the layout change is expected
  to keep it green (not auto-run here — heavy).
- Test updates needed for the de-dup (verified 2026-09-04): **processor — none** (no test
  asserts logger args). **Downloader — five unit assertions:** `downloader-service.test.ts:204-207`
  (msg-only), `downloader-service.test.ts:223-226` (drop `mappingId`/`runId` from
  `objectContaining`), `csv-converter-cli.test.ts:74-77`/`:91-94`/`:95-98` (drop `connectionId`
  from `objectContaining`). **Backend — one:** `connectionTestRunnerService.test.ts:135-144`
  gains `"-e","CONNECTION_ID=conn9"`. No snapshots or layout-shape tests exist.
