# Worker Logging Correlation Plan (processor + downloader)

> **Status:** DESIGN — not yet approved for implementation. Open decisions are listed in
> [Open decisions](#open-decisions) and must be resolved before editing code.
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
  storesprite-be change to export `CONNECTION_ID` (added after a code check on 2026-09-04 — see
  O1/O2 and Task 1). Live verification.
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
  export `TEST_CONNECTION`, `USER_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`. **`CONNECTION_ID` is
  not yet exported anywhere** and must be added (Task 1). The **only live mapping-run dispatch
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
  connection ids are on every line in `correlation`. An id-based marker line can be added later
  if wanted (Open decision O4). [User-led]
- **D4 — Correlation ids grouped in ONE nested `correlation` object, not flat top-level fields
  and not inside `context`.** Target: `{ ts, level, category, correlation, msg, context }`.
  Chosen for readability-at-a-glance on each log line. OpenSearch still filters nested fields
  via dotted path (`correlation.mappingId`); this is a plain `object`, not a `nested` datatype.
  [User-confirmed 2026-09-04]
- **D5 — Correlation fields emitted only when their env var is present/non-empty.** A run with
  no connection/user id must not emit empty fields; if no id env is set, the whole `correlation`
  key is omitted. The `msg`/`context` behavior is unchanged.
- **D6 — No duplicate run-level ids in `context`.** Because `correlation` stamps the run-level
  ids on every line, every existing log callsite that repeats `mappingId`/`runId`/`userId`/
  `connectionId` in its `context` drops those keys (single-connection model ⇒ `connectionId` is
  run-level, so it is dropped there too). `context` keeps only genuinely per-line data
  (counters, counts, file paths, names, host, errors, …). Business result objects
  (`results.push({ connectionId, … })`) are NOT log contexts and stay untouched.
  [User-confirmed 2026-09-04]

### Env contract

| `correlation` field | Env var read | processor | downloader |
|---|---|---|---|
| `correlation.mappingId` | `MAPPING_ID` | ✅ (already required env) | ✅ (shared container) |
| `correlation.runId` | `RUN_ID` | ✅ (already required env) | ✅ (shared container) |
| `correlation.connectionId` | `CONNECTION_ID` | ✅ orchestrator sets it (O1/O2, Task 1) | ✅ orchestrator sets it (O1/O2, Task 1) |
| `correlation.userId` | `USER_ID` | ✅ (emitted when set) | ✅ |

Each id is emitted only when its env var is set; `correlation` is omitted when none are set (D5).

Target per-line shapes — **identical for both workers** [User-confirmed 2026-09-04]:
- processor: `{ ts, level, category, correlation: { mappingId, runId, connectionId, userId }, msg, context }`
- downloader: `{ ts, level, category, correlation: { mappingId, runId, connectionId, userId }, msg, context }`

## Open decisions (resolve before implementing)

- **O1 — [RESOLVED 2026-09-04] Env var names confirmed by code.** `MAPPING_ID`, `RUN_ID`,
  `USER_ID` are exactly the names the orchestrator already exports for mapping runs — no worker
  read-name change needed. `CONNECTION_ID` is **not yet exported**; adding it is the in-scope
  backend Task 1. (Details in F8.)
- **O2 — [RESOLVED 2026-09-04] Who exports `CONNECTION_ID`.** The orchestrator
  (storesprite-be, `ConnectionTestRunnerService`) **will** pass the connection id as container
  env `CONNECTION_ID` to the worker. [User-confirmed 2026-09-04] In scope as Task 1 (backend).
  Connection-test mode additionally gains `CONNECTION_ID` (keeps `TEST_CONNECTION` as its mode
  signal). The workers only *read* the var; when absent the field is simply not emitted (D5).
- **O3 — [RESOLVED] Which workers stamp `userId`?** **Both** — processor and downloader emit an
  identical `correlation.userId` (emitted when `USER_ID` env is set). [User-confirmed 2026-09-04]
- **O4 — Is an explicit single "run started" marker line wanted** (carrying the ids), or is
  `correlation` on every line sufficient? Default: not added (D3).
- **O5 — Field emission for optional ids:** keep ids out when unset (D5). Confirm acceptable for
  OpenSearch (missing fields vs `null`).

## Design

### Layout change (both `log4js.config.ts` files)

1. Read the four ids from `process.env` into a `correlation` record. Do it once per process —
   the layout factory is built at `configureLogger()` time, so snapshot there (or on first use).
   Build order: `mappingId`, `runId`, `connectionId`, `userId`.
2. In the entry object, after `category` and before `msg`, insert `correlation` when the
   snapshot is non-empty: `{ ts, level, category, correlation, msg, context }`.
3. Leave `msg`/`context` handling byte-identical to today (message text = `data[0]`; `context`
   = `data[1]` when a plain object). `context` is unchanged by the layout — de-duplication
   happens at the callsites (D6).
4. Do **not** change categories (`processor` / `downloader`), appender topology, LOG_LEVEL
   handling, or `getLogger` defaults.

No business/service *logic* changes are needed for D1 (stamping is layout-level). The D6
callsite edits below only remove now-redundant keys from log `context` objects.

## Tasks

### Task 1 — Backend (storesprite-be): export `CONNECTION_ID` to the worker container

The orchestrator must pass the connection id so the workers can stamp `correlation.connectionId`.
The only live mapping-run dispatch site is `SchedulerService._dispatchMappingRun`; the manual
Run-now path is a stub today. `Mapping.connection` is a `@ManyToOne` owning the FK, so
`mapping.connection?.id` is available synchronously.

**Files:**
- Modify: `storesprite-be/src/types/stocksprite/ConnectionTestRunnerService.interface.ts`
- Modify: `storesprite-be/src/services/stocksprite/ConnectionTestRunnerService.ts`
- Modify: `storesprite-be/src/services/stocksprite/SchedulerService.ts`
- Test: `storesprite-be/test/...` — update any `runMapping` mock-call assertions for the new arg.

- [ ] **Step 1 — Add `connectionId` to the interface.** In
  `ConnectionTestRunnerService.interface.ts`, change `runMapping(mappingId, runId, userId,
  token, backendUrl)` to add a `connectionId` parameter (keep the scalar style of the other
  params). `runTest(...)` signature is unchanged (it already receives `connectionId`).
- [ ] **Step 2 — Export `CONNECTION_ID` in `ConnectionTestRunnerService`.**
  - `runMapping(...)`: accept the new `connectionId` param; add `CONNECTION_ID: connectionId`
    to the `_runContainer` env payload next to `MAPPING_ID`/`RUN_ID`/`USER_ID` (omit the key
    when the id is empty).
  - `runTest(...)`: add `CONNECTION_ID: connectionId` to its env payload; keep `TEST_CONNECTION`
    (it is the connection-test mode signal the worker switches on).
- [ ] **Step 3 — Pass the id from the dispatch site.** In `SchedulerService.ts` (~line 104),
  call `this._runner.runMapping(mapping.id, run.id, mapping.connection?.id, userId, token,
  backendUrl)`. Guard: if the connection id is undefined, still call `runMapping` but let the
  id be empty so `CONNECTION_ID` is omitted (D5).
- [ ] **Step 4 — Verify.** Run in container:
  `MSYS_NO_PATHCONV=1 docker exec storesprite-be sh -c 'cd /workspace/storesprite-be && npm test && npm run build && npm run lint'`
  Fix any unit test that asserts the old `runMapping` call signature/args.

> Note: `MappingService.runMapping` (`mappingsApi.ts:176`) is a stub that never dispatches a
> container — no change there now; when "Run now" is wired it must pass the connection id too.

### Task 2 — Processor: stamp `correlation` + drop redundant ids from `context`

**Files:**
- Modify: `stocksprite/processor/src/config/log4js.config.ts` (layout change above).
- Modify: `stocksprite/processor/src/index.ts`
- Modify: `stocksprite/processor/src/services/processor.service.ts`
- Modify: `stocksprite/processor/src/services/backend-api-client.ts`

- [ ] **Step 1 — Layout:** implement the `correlation` snapshot + insertion in
  `log4js.config.ts` (Design above). Ids read from `MAPPING_ID`, `RUN_ID`, `CONNECTION_ID`,
  `USER_ID`.
- [ ] **Step 2 — `index.ts` de-dup:** drop the ids from the three log contexts — "Stock
  processor starting" (msg only), "Stock processor exiting" (`{ exitCode }`), "Fatal error
  during processor startup" (`{ error: message }`). Then remove the now-unused
  `let mappingId/runId` locals, their `config` assignment, and `import type { AppConfig }` if
  nothing else uses it.
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
  Smoke: run `dist/index.js` with `MAPPING_ID`/`RUN_ID`/`CONNECTION_ID`/`USER_ID` against a
  failing backend; confirm every stdout line carries
  `"correlation":{"mappingId":...,"runId":...,"connectionId":...,"userId":...}` and no id is
  duplicated in `context`.

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
- [ ] **Step 2 — `index.ts` de-dup:** "Initializing StoreSprite Downloader Service" → msg only;
  "Downloader finished with errors" → `{ successCount, errorCount }`; "Downloader completed
  successfully without errors" → msg only; "Fatal exception during downloader execution" →
  `{ error: errorMsg }`. Then remove the now-unused `userId` local, its `config` assignment, and
  `import type { AppConfig }` if nothing else uses it.
- [ ] **Step 3 — `downloader-service.ts` de-dup.** Full mode: "Starting Downloader session" →
  `{ outputDir, backendUrl }`; the no-active-connections warn → `{ total, active }`;
  "Processing connection …" → `{ name, channel, dataFormat }`; "Successfully processed
  connection …" → `{ csvFilePath, isUnchanged }`; "Error processing connection …" →
  `{ name, error }`; "Downloader session completed…" → `{ successCount, errorCount }`. Test
  mode: "Executing single connection test mode" → msg only; "Connection test completed
  successfully" → `{ rowCount, columnCount, durationMs }`; "Connection test failed" →
  `{ error }`; "Failed to report test failure to backend" → `{ error }`. Keep the
  business `results.push({ connectionId, … })` objects (lines ~86/110) unchanged.
- [ ] **Step 4 — Leaf services de-dup:** in `xml-converter.ts`, `csv-converter.ts`,
  `http-downloader.ts`, `sftp-downloader.ts`, remove `connectionId: connection.id` from each
  logger `context` (keep `name`, `host`, `remoteDir`, `remoteFilePath`, `fileSize`,
  `destinationPath`, `byteCount`, `isUnchanged`, `inputRawPath`, `outputCsvPath`, `targetRowTag`,
  `encoding`, `rowCount`, `columnCount`, etc.). The downloaders/converters still receive
  `connection` and use `connection.id` in file paths — only the log contexts lose the key.
- [ ] **Step 5 — `backend-api-client.ts` de-dup:** "Fetching single connection from backend" →
  `{ url }`; "Reporting test result to backend" → `{ progress: result.progress }`.
- [ ] **Step 6 — Verify + smoke.** Run:
  `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm run build && npm run lint && npm test'`
  Smoke: run `dist/index.js` with `USER_ID` (+ `RUN_ID`/`MAPPING_ID`/`CONNECTION_ID`) against a
  failing backend; confirm `correlation` on init + connection + fatal lines and no id duplicated
  in `context`.

### Task 4 — (Optional, only if O4 = yes) id-based session-start marker
- Add a single run-start log carrying the correlation ids per run; verify as above.

### Task 5 — Docs (only if any doc states the old field shape or mentions connection name)
- Grep for the JSON field list / `context` description across `CONSTITUTION.md`,
  `stocksprite/readme.md`, and worker docs; update if they enumerate fields or imply a name.

## Global constraints (verbatim from prior approved migration work; applies to any edit)

- **Commit only when the user asks.** No commit steps in tasks.
- **Tests/builds/lint run in-container only** via `docker exec stocksprite-dev` — never host
  Node.
- Git edits on host; each project has its own `package.json`/`package-lock.json`; no dependency
  changes are expected here (layout + log-context edits only) — if any dep is needed, run
  `npm install` in that project's container.

## Risks / notes

- **Downloader "full mode" vs single-connection model:** the container's entrypoint runs the
  downloader before the processor, and `downloader-service.run()` has a full mode
  (`downloader-service.ts:46-120`, no `TEST_CONNECTION`) that loops **every** active connection
  of the user. Under the single-connection model (F9) a mapping run should not reach that path.
  Whether to scope the downloader to `CONNECTION_ID` is a separate behavior change — flagged,
  **out of scope** for this logging plan.
- The two `jsonWithDataFieldLayout` copies must be kept in sync manually (D-free choice,
  documented). If drift becomes an issue, extracting a shared layout package is a follow-up.
- `correlation.connectionId` requires `CONNECTION_ID` to be exported by the orchestrator (Task 1);
  until then the field is simply absent (D5) and behavior is otherwise unchanged.
- Downloader keeps its file appender (stdout + `<outputDir>/downloader.log`); not changing it.
- The downloader integration suite asserts on stdout *message* substrings, which survive inside
  JSON `msg`; the layout change is expected to keep it green (not auto-run here — heavy).
- Existing log-assertion unit tests in processor/downloader that `expect(logger.info).toHaveBeenCalledWith("msg", { ... })` with the old full context object must be updated to the new
  reduced context (Task 2/3 verification will surface them).
