# Scope Downloader to One Connection per Mapping Run — Implementation Plan (mechanical edition)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scheduled mapping run downloads and converts exactly the one connection the mapping points at — never every active connection — so no downloaded data is ever discarded.

**Architecture:** The combined container already runs per mapping (the scheduler dispatches one job per due mapping), but the downloader still behaves like the legacy "mirror every feed" batch stage: with no `TEST_CONNECTION` it fetches the user's connection list, downloads + converts **all** active connections into `/app/temp`, and the processor then maps **one** of those CSVs (`<outputDir>/<mapping.connectionId>.csv`); nothing consumes the rest. The fix adds a single `CONNECTION_ID` env var to a mapping run. The downloader fetches that one connection by id (the existing `GET /connections/:id` internal endpoint), downloads + converts it to `<connectionId>.csv`, refuses an inactive/missing connection, and exits non-zero on failure so the Dockerfile `&&` chain skips the processor. To make the failure visible in run history, the downloader reports the run error to the existing mapping-progress endpoint before exiting.

**Tech Stack:** Node 24 + TypeScript ESM, MikroORM + Fastify (storesprite-be), log4js, Vitest 4 + vitest-mock-extended, Docker (combined worker image), WireMock + docker-compose (integration harness).

**Spec:** No separate spec doc — this is the converged design from the downloader bug investigation. Decided with the user: keep `CONNECTION_ID`, `RUN_ID`, `USER_ID`, `MAPPING_ID` all as env vars injected by the backend at spawn; an inactive/gone connection makes the downloader exit non-zero so the run fails visibly in history; the processor keeps reading `<outputDir>/<connectionId>.csv` unchanged.

## How to execute this plan (READ THIS FIRST)

This plan was rewritten so a low-reasoning model can implement it as pure mechanical work. It contains **no decisions**. Follow these rules exactly:

1. **Order matters.** Do Tasks in order (1 → 6) and Steps within a Task in order. Each later Task/Step assumes the earlier ones are already done and verified green.
2. **Edits happen on the host filesystem.** `npm test` / `npm run build` / `npm run lint` / `npm run test:integration` are the ONLY things run inside containers (each verify Step gives the exact command). Never run them on the host. Never create or edit files inside a container.
3. **Three edit forms are used.**
   - "**Overwrite `<path>` with:** `<block>`" — delete ALL current content of that file and paste the block that follows. Copy it character-for-character: indentation, blank lines, quotes, commas.
   - "**In `<path>` replace `<old>` with `<new>`**" — find the exact `<old>` text and replace it. It appears once unless the step says "replace all occurrences".
   - "**Delete lines `A–B`**" — delete those exact line numbers. The numbers refer to the file **as it is when you start that Step** (do the Steps in order and the numbers stay valid).
4. **Copy code and JSON blocks verbatim.** Do not "improve", rename, reorder, reformat, or add comments. Do not add or remove trailing commas. If something looks wrong, STOP and report — do not improvise.
5. **Verify gates.** Each Task ends with a command under "Run:" plus its expected outcome under "Expected:". Run it, read the output, and confirm it matches "Expected". If output differs (any failure, any error you did not cause), STOP and report. Do not attempt a workaround.
6. **Known deliberate non-green states.** Task 2 and Task 3 deliberately leave the downloader unit-test suite red (old tests still call a deleted method). Do NOT run the downloader unit suite between Task 2 Step 3 and Task 4 Step 3; only run the exact verify commands each Step lists.
7. **No commits anywhere.** No `git commit`, no `git push`. The only git-adjacent action allowed is the final `git status` in Task 6.

## Background / why this is the bug

- `SchedulerService.runDue` dispatches **one** combined container per due mapping (`_dispatchMappingRun` → `ConnectionTestRunnerService.runMapping`).
- The combined image CMD (Dockerfile line 79) runs the downloader first, then the processor only if the downloader exited 0 and `TEST_CONNECTION` is unset.
- `DownloaderService.run()` full mode (no `TEST_CONNECTION`) loops every active connection; the processor reads exactly one file. Nothing else reads the leftover CSVs → pure wasted download compute.
- The processor reports run progress (`start`/`parse`/`download`/… /`finish`/`error`) to `POST /mappings/:id/progress` keyed by `MAPPING_ID` env + a `RUN_ID` in the body; the backend resolves the scheduler-created `MappingHistory` row by `runId` and flips it to success/partial/failed. If the downloader fails, the processor never runs, so **nobody** marks the row — unless the downloader does it itself. Hence the new `reportRunError` call.

## Environment contract after this change

Mapping-run container env, all injected by the backend at spawn:

| Variable | Downloader | Processor | Set from |
|---|---|---|---|
| `CONNECTION_ID` | required for run mode (downloads this one connection) | not read | `mapping.connection.id` (scheduler) |
| `MAPPING_ID` | optional (only used to report a run error) | required | scheduler |
| `RUN_ID` | optional (only used to report a run error) | required | scheduler-created history row PK |
| `USER_ID` | required (logs/summary; future log correlation) | not read functionally | `mapping.user.id` |
| `INTERNAL_TOKEN` | required (prod) | required (prod) | backend env |
| `BACKEND_URL` | required | required | backend env |
| `OUTPUT_DIR` | required (`/app/temp`) | required | `/app/temp` |

Connection-test container env is unchanged: `TEST_CONNECTION` + `USER_ID` + `INTERNAL_TOKEN` + `BACKEND_URL`. Because a test container has no `CONNECTION_ID`/`MAPPING_ID`/`RUN_ID`, those three stay **optional** in the downloader config struct and are validated in `run()`.

The processor and the backend run-config endpoint are **untouched** by this plan: the processor still fetches config by `MAPPING_ID` and reads `<outputDir>/<mapping.connectionId>.csv`, and `mapping.connectionId` (from run-config) always equals the `CONNECTION_ID` the downloader was given, because the scheduler derives both from the same mapping row.

**Cross-plan note:** this plan's backend Task 1 (exporting `CONNECTION_ID` through `runMapping`) is also Task 1 of the paused `2026-09-04-worker-logging-correlation.md` plan. When we return to the logging refactor, that prerequisite is already done.

## Global Constraints

- **Tests/builds/lint/installs run in-container only**, never with a host Node runtime. Pattern: `MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm test'` and `MSYS_NO_PATHCONV=1 docker exec storesprite-be sh -c 'cd /workspace/storesprite-be && npm test'`. `stocksprite/downloader` and `stocksprite/processor` live in the `stocksprite-dev` container; `storesprite-be` has its own.
- **Commit ONLY when the user asks.** Tasks make edits and verify; no commit steps.
- The processor project (`stocksprite/processor`) is out of scope — do not modify it.
- The internal `/users/:userId/connections` backend route is left in place (it becomes worker-unused but may serve other tooling); removing it is out of scope.
- Do not touch the combined image `Dockerfile` (its `&&` short-circuit is the mechanism that keeps the processor off a failed download).
- Downloader output naming stays `<outputDir>/<connectionId>.csv` (plain id, no `test_` prefix, no cleanup) so the processor's existing read is unchanged.

---
## Task 1 — Backend: pass `CONNECTION_ID` at dispatch

**Files:**
- Modify: `storesprite-be/src/types/stocksprite/ConnectionTestRunnerService.interface.ts`
- Modify: `storesprite-be/src/services/stocksprite/ConnectionTestRunnerService.ts`
- Modify: `storesprite-be/src/services/stocksprite/SchedulerService.ts` (1 line)
- Modify: `storesprite-be/tests/unit/services/stocksprite/connectionTestRunnerService.test.ts`
- Modify: `storesprite-be/tests/unit/services/stocksprite/schedulerService.test.ts`

**Interfaces:**
- Produces: `IConnectionTestRunnerService.runMapping(connectionId: string, mappingId: string, runId: string, userId: string, token: string, backendUrl: string): Promise<void>` (connectionId prepended). Later tasks rely on `CONNECTION_ID` being present in the spawned container env.

### Step 1.1 — Overwrite the interface file

Overwrite `storesprite-be/src/types/stocksprite/ConnectionTestRunnerService.interface.ts` with:

```ts
export interface IConnectionTestRunnerService {
  runTest(connectionId: string, userId: string, token: string, backendUrl: string): Promise<void>;
  runMapping(
    connectionId: string,
    mappingId: string,
    runId: string,
    userId: string,
    token: string,
    backendUrl: string
  ): Promise<void>;
}
```

### Step 1.2 — Overwrite the implementation file

Overwrite `storesprite-be/src/services/stocksprite/ConnectionTestRunnerService.ts` with:

```ts
import { spawn } from "node:child_process";
import path from "node:path";
import { injectable, inject, optional } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../../di/types.js";
import { Util } from "../../utils/index.js";
import { IConnectionTestRunnerService } from "../../types/stocksprite/ConnectionTestRunnerService.interface.js";

/**
 * Dispatches the combined `storesprite-worker` container. The image always runs the
 * downloader first; `TEST_CONNECTION` short-circuits after it (connection test), and
 * otherwise the processor continues with MAPPING_ID/RUN_ID (mapping run).
 */
@injectable()
export class ConnectionTestRunnerService implements IConnectionTestRunnerService {
  constructor(
    @inject(TYPES.Logger)
    @optional()
    private readonly _logger?: Logger
  ) {}

  public async runTest(
    connectionId: string,
    userId: string,
    token: string,
    backendUrl: string
  ): Promise<void> {
    await Promise.resolve();
    const driver = this._resolveDriver();
    this._logger?.info("Dispatching connection test runner", {
      connectionId,
      userId,
      driver,
      backendUrl,
    });

    if (driver === "cloud_run") {
      this._logger?.info("Cloud Run worker execution selected", { connectionId });
      return;
    }

    if (driver === "noop" || process.env.NODE_ENV?.toLowerCase() === "test") {
      this._logger?.info("Noop/test driver selected, skipping spawn", { connectionId });
      return;
    }

    void this._runContainer(this._imageName(), {
      TEST_CONNECTION: connectionId,
      USER_ID: userId,
      INTERNAL_TOKEN: token,
      BACKEND_URL: backendUrl,
    });
  }

  public async runMapping(
    connectionId: string,
    mappingId: string,
    runId: string,
    userId: string,
    token: string,
    backendUrl: string
  ): Promise<void> {
    await Promise.resolve();
    const driver = this._resolveDriver();
    this._logger?.info("Dispatching mapping runner", {
      connectionId,
      mappingId,
      runId,
      userId,
      driver,
      backendUrl,
    });

    if (driver === "cloud_run") {
      this._logger?.info("Cloud Run worker execution selected", { mappingId });
      return;
    }

    if (driver === "noop" || process.env.NODE_ENV?.toLowerCase() === "test") {
      this._logger?.info("Noop/test driver selected, skipping spawn", { mappingId });
      return;
    }

    void this._runContainer(this._imageName(), {
      CONNECTION_ID: connectionId,
      MAPPING_ID: mappingId,
      RUN_ID: runId,
      USER_ID: userId,
      INTERNAL_TOKEN: token,
      BACKEND_URL: backendUrl,
      OUTPUT_DIR: "/app/temp",
    });
  }

  private _spawnDocker(
    args: string[]
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
  }

  private _resolveDriver(): string {
    const nodeEnv = (process.env.NODE_ENV || "dev").toLowerCase();
    const defaultDriver = nodeEnv === "prod" || nodeEnv === "production" ? "cloud_run" : "docker";
    return (process.env.INTERNAL_DRIVER || defaultDriver).toLowerCase();
  }

  private _imageName(): string {
    return process.env.STOCKSPRITE_IMAGE || "storesprite-worker:latest";
  }

  private async _ensureImageExists(imageName: string): Promise<void> {
    const inspect = await this._spawnDocker(["image", "inspect", imageName]);
    if (inspect.code === 0) {
      return;
    }

    this._logger?.info(`Docker image '${imageName}' not found locally. Building on-demand...`);

    const buildContext = process.env.STOCKSPRITE_BUILD_CONTEXT || "/workspace";
    const configuredDockerfile = process.env.STOCKSPRITE_DOCKERFILE || "stocksprite/Dockerfile";
    // `-f` is resolved relative to the spawned CLI's working directory (the backend's
    // own cwd), NOT the build context. Resolve relative paths against the context so the
    // on-demand build works regardless of which directory the backend runs from.
    const dockerfile = path.isAbsolute(configuredDockerfile)
      ? configuredDockerfile
      : path.resolve(buildContext, configuredDockerfile);
    const build = await this._spawnDocker(["build", "-f", dockerfile, "-t", imageName, buildContext]);

    if (build.code === 0) {
      this._logger?.info(`Successfully built '${imageName}' on-demand.`);
      return;
    }

    const err = new Error(`Failed to build '${imageName}': ${build.stderr.trim()}`);
    this._logger?.error("Docker build error", { error: err.message });
    throw err;
  }

  private async _runContainer(imageName: string, env: Record<string, string>): Promise<void> {
    const dockerNetwork = process.env.DOCKER_NETWORK || "storesprite-shared-net";

    try {
      await this._ensureImageExists(imageName);
    } catch (buildError) {
      this._logger?.error("Could not ensure Docker image before run", {
        error: Util.stringifyError(buildError),
      });
      return;
    }

    const args = ["run", "--rm", "-d", `--network=${dockerNetwork}`];
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }
    args.push(imageName);

    this._logger?.info("Spawning docker container", { command: "docker", args });

    try {
      const { code, stdout, stderr } = await this._spawnDocker(args);
      if (code !== 0) {
        this._logger?.error("Docker run failed to launch container", {
          code,
          stderr: stderr.trim(),
          stdout: stdout.trim(),
        });
      } else {
        this._logger?.info("Docker worker container launched successfully", {
          containerId: stdout.trim(),
        });
      }
    } catch (error) {
      this._logger?.error("Failed to spawn docker container", {
        error: Util.stringifyError(error),
      });
    }
  }
}
```

### Step 1.3 — Pass the connection id from the scheduler (one line)

In `storesprite-be/src/services/stocksprite/SchedulerService.ts`, find the exact line:

```ts
    void this._runner.runMapping(mapping.id, run.id, userId, token, backendUrl);
```

Replace that one line with:

```ts
    void this._runner.runMapping(mapping.connection.id, mapping.id, run.id, userId, token, backendUrl);
```

Notes: `mapping.connection.id` reads the FK column on the mapping row and is available synchronously even though `getEnabledSchedules()` only populates `user` (a `@ManyToOne` id is always readable from the owning row). This line is currently line 104; after Step 1.1/1.2 in OTHER files, the SchedulerService file itself is unchanged, so the line number is still valid — but the quoted text is the reliable anchor.

### Step 1.4 — Update the runner unit test

File: `storesprite-be/tests/unit/services/stocksprite/connectionTestRunnerService.test.ts`.

1. **Replace all 7 call sites.** In this file, replace ALL occurrences (there are exactly 7; a "replace all" in your editor) of the exact string:

```ts
service.runMapping("map1", "run1", "u1", "tok", "http://be:3000")
```

with:

```ts
service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000")
```

   The 7 sites are currently at lines 98, 165, 205, 239, 255, 263, 272. After the replace-all, confirm you changed 7 (search for `service.runMapping("conn1"` and count — it must be 7).

2. **Update the mapping-run env assertion.** In the same file, find this exact block (it is inside the test `"runMapping: spawns docker run with the mapping environment once the image exists"`, currently lines 108–121):

```ts
    expect(env).toEqual([
      "-e",
      "MAPPING_ID=map1",
      "-e",
      "RUN_ID=run1",
      "-e",
      "USER_ID=u1",
      "-e",
      "INTERNAL_TOKEN=tok",
      "-e",
      "BACKEND_URL=http://be:3000",
      "-e",
      "OUTPUT_DIR=/app/temp",
    ]);
```

Replace that whole block with:

```ts
    expect(env).toEqual([
      "-e",
      "CONNECTION_ID=conn1",
      "-e",
      "MAPPING_ID=map1",
      "-e",
      "RUN_ID=run1",
      "-e",
      "USER_ID=u1",
      "-e",
      "INTERNAL_TOKEN=tok",
      "-e",
      "BACKEND_URL=http://be:3000",
      "-e",
      "OUTPUT_DIR=/app/temp",
    ]);
```

The `runTest` env assertion (the block starting `"-e", "TEST_CONNECTION=conn9",`) is **unchanged** — do not touch it.

### Step 1.5 — Update the scheduler unit test

File: `storesprite-be/tests/unit/services/stocksprite/schedulerService.test.ts`. Make three edits in the file, in this order:

1. **Give the fixture connection an id.** Find this block (currently lines 22–33):

```ts
  const user = new User("u1", "u1@t.com", "U");
  const conn = new DataConnection(
    user,
    "Feed",
    "HTTP",
    "CSV",
    { channel: "HTTP", url: "https://x" },
    { format: "CSV", delimiter: ";" },
    true,
    null,
    { success: true, columns: ["sku"] }
  );
```

Add one line immediately after the closing `);` of the `new DataConnection(...)` — i.e. right after the `{ success: true, columns: ["sku"] }` line. The block becomes:

```ts
  const user = new User("u1", "u1@t.com", "U");
  const conn = new DataConnection(
    user,
    "Feed",
    "HTTP",
    "CSV",
    { channel: "HTTP", url: "https://x" },
    { format: "CSV", delimiter: ";" },
    true,
    null,
    { success: true, columns: ["sku"] }
  );
  conn.id = "conn1";
```

2. **Update the destructure assertion.** Find this block (currently lines 81–85, inside the test `"dispatches a due mapping: supersedes, opens a run, prunes, spawns the runner"`):

```ts
    const [, runId, userId, token, backendUrl] = runnerMock.runMapping.mock.calls[0];
    expect(runId).toBe("run1");
    expect(userId).toBe("u1");
    expect(token).toBe("");
    expect(backendUrl).toBe("http://storesprite-be:3000");
```

Replace it with:

```ts
    const [connectionId, mappingId, runId, userId, token, backendUrl] = runnerMock.runMapping.mock.calls[0];
    expect(connectionId).toBe("conn1");
    expect(mappingId).toBe("m1");
    expect(runId).toBe("run1");
    expect(userId).toBe("u1");
    expect(token).toBe("");
    expect(backendUrl).toBe("http://storesprite-be:3000");
```

3. **Update the strict call assertion.** Find this exact line (currently line 101, inside the test `"passes the configured internal token and backend URL to the runner"`):

```ts
    expect(runnerMock.runMapping).toHaveBeenCalledWith("m1", "run1", "u1", "secret-token", "http://be:3000");
```

Replace it with:

```ts
    expect(runnerMock.runMapping).toHaveBeenCalledWith("conn1", "m1", "run1", "u1", "secret-token", "http://be:3000");
```

### Step 1.6 — Verify the backend

Run:

```bash
MSYS_NO_PATHCONV=1 docker exec storesprite-be sh -c 'cd /workspace/storesprite-be && npm test && npm run test:integration && npm run build && npm run lint'
```

Expected: **green** (all unit + integration tests pass, build succeeds, lint has 0 errors). Specifically `tests/unit/services/stocksprite/schedulerService.test.ts` and `connectionTestRunnerService.test.ts` pass. (`tests/integration/stocksprite/schedulerApi.test.ts` binds a runner that short-circuits under `NODE_ENV=test` and does not assert the `runMapping` argument list, so no change is needed there.)

---
## Task 2 — Downloader config + API client (add `CONNECTION_ID`/run-identity, drop `getUserConnections`, add `reportRunError`)

**Files:**
- Modify: `stocksprite/downloader/src/config/app.config.ts`
- Modify: `stocksprite/downloader/src/types/backend-api-client.interface.ts`
- Modify: `stocksprite/downloader/src/services/backend-api-client.ts`

**Interfaces:**
- Consumes: Task 1 guarantees a mapping-run container has `CONNECTION_ID`, `MAPPING_ID`, `RUN_ID`, `USER_ID` env.
- Produces: `AppConfig` gains `connectionId?: string`, `mappingId?: string`, `runId?: string`. `IBackendApiClient` gains `reportRunError(mappingId: string, runId: string, error: string): Promise<void>` and loses `getUserConnections`. Task 3 consumes both.

### Step 2.1 — Overwrite the downloader config

Overwrite `stocksprite/downloader/src/config/app.config.ts` with:

```ts
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  userId: string;
  internalToken: string;
  backendUrl: string;
  outputDir: string;
  testConnectionId?: string;
  connectionId?: string;
  mappingId?: string;
  runId?: string;
}

export function getAppConfig(): AppConfig {
  const userId = process.env.USER_ID?.trim();
  if (!userId) {
    throw new Error("Missing required environment variable: USER_ID");
  }

  const internalToken = process.env.INTERNAL_TOKEN?.trim();
  if (!internalToken && process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: INTERNAL_TOKEN");
  }
  const backendUrl = (process.env.BACKEND_URL?.trim() || "http://storesprite-be:3000").replace(/\/+$/, "");
  const outputDir = process.env.OUTPUT_DIR?.trim() || path.resolve(process.cwd(), "temp");
  const testConnectionId = process.env.TEST_CONNECTION?.trim() || undefined;
  const connectionId = process.env.CONNECTION_ID?.trim() || undefined;
  const mappingId = process.env.MAPPING_ID?.trim() || undefined;
  const runId = process.env.RUN_ID?.trim() || undefined;

  return {
    userId,
    internalToken: internalToken || "mock_internal_token",
    backendUrl,
    outputDir,
    testConnectionId,
    connectionId,
    mappingId,
    runId,
  };
}
```

`USER_ID` stays required (test containers and mapping containers both set it; it is still used for logs/summary and later for log correlation).

### Step 2.2 — Overwrite the API-client interface

Overwrite `stocksprite/downloader/src/types/backend-api-client.interface.ts` with:

```ts
import { DataConnectionDto, ConnectionTestResult } from "./connection.types.js";

export interface IBackendApiClient {
  getConnectionById(connectionId: string): Promise<DataConnectionDto>;
  reportTestResult(connectionId: string, result: Partial<ConnectionTestResult>): Promise<void>;
  reportRunError(mappingId: string, runId: string, error: string): Promise<void>;
}
```

### Step 2.3 — Overwrite the API client implementation

Overwrite `stocksprite/downloader/src/services/backend-api-client.ts` with:

```ts
import { injectable, inject } from "inversify";
import axios from "axios";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { AppConfig } from "../config/app.config.js";
import { IBackendApiClient } from "../types/backend-api-client.interface.js";
import { DataConnectionDto, ConnectionTestResult } from "../types/connection.types.js";
import { ErrorUtil } from "../utils/error-util.js";

@injectable()
export class BackendApiClient implements IBackendApiClient {
  constructor(
    @inject(TYPES.AppConfig) private readonly _config: AppConfig,
    @inject(TYPES.Logger) private readonly _logger: Logger
  ) {}

  private _extractErrorMessage(error: unknown): string {
    const base = ErrorUtil.stringifyError(error);
    if (axios.isAxiosError(error) && error.response?.data) {
      const responseData = error.response.data as { error?: string; message?: string };
      return responseData.error || responseData.message || `HTTP ${error.response.status}: ${error.message}`;
    }
    return base;
  }

  public async getConnectionById(connectionId: string): Promise<DataConnectionDto> {
    const url = `${this._config.backendUrl}/api/internal/stocksprite/connections/${connectionId}`;
    this._logger.info("Fetching single connection from backend", { connectionId, url });

    try {
      const response = await axios.get<{ connection: DataConnectionDto }>(url, {
        headers: {
          "x-internal-token": this._config.internalToken,
        },
        timeout: 10000,
      });

      if (!response.data?.connection) {
        throw new Error(`Connection '${connectionId}' not found in backend response`);
      }

      return response.data.connection;
    } catch (error) {
      const errorMsg = this._extractErrorMessage(error);
      this._logger.error("Failed to fetch connection from backend", {
        connectionId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to fetch connection '${connectionId}': ${errorMsg}`);
    }
  }

  public async reportTestResult(
    connectionId: string,
    result: Partial<ConnectionTestResult>
  ): Promise<void> {
    const url = `${this._config.backendUrl}/api/internal/stocksprite/connections/${connectionId}/test-result`;
    this._logger.info("Reporting test result to backend", { connectionId, progress: result.progress });

    try {
      await axios.patch(url, result, {
        headers: {
          "x-internal-token": this._config.internalToken,
        },
        timeout: 15000,
      });
    } catch (error) {
      const errorMsg = this._extractErrorMessage(error);
      this._logger.error("Failed to report test result to backend", {
        connectionId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to report test result for '${connectionId}': ${errorMsg}`);
    }
  }

  public async reportRunError(mappingId: string, runId: string, error: string): Promise<void> {
    const url = `${this._config.backendUrl}/api/internal/stocksprite/mappings/${mappingId}/progress`;
    this._logger.info("Reporting mapping run error to backend", { mappingId, runId, url });

    try {
      await axios.post(
        url,
        { runId, progress: "error", error },
        {
          headers: {
            "x-internal-token": this._config.internalToken,
          },
          timeout: 15000,
        }
      );
    } catch (err) {
      const errorMsg = this._extractErrorMessage(err);
      this._logger.error("Failed to report mapping run error to backend", {
        mappingId,
        runId,
        url,
        error: errorMsg,
      });
      throw new Error(`Failed to report run error for mapping '${mappingId}': ${errorMsg}`);
    }
  }
}
```

The whole `getUserConnections` method is gone (that is the point). The backend route `POST /mappings/:id/progress` already handles `progress: "error"` by setting `history.error`, `status = "failed"`, and `finishedAt`.

### Step 2.4 — Verify build/lint (unit tests NOT yet run)

Run:

```bash
MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm run build && npm run lint'
```

Expected: build + lint green. The unit tests are updated in Task 4, so at this point `npm test` would be red (two `getUserConnections` unit tests still exist and call a deleted method) — **that is fine and deliberate. Do not run `npm test` here.**

---
## Task 3 — Downloader: single-connection mapping run mode

**Files:**
- Modify: `stocksprite/downloader/src/services/downloader-service.ts`

**Interfaces:**
- Consumes: Task 1 injects `CONNECTION_ID`/`MAPPING_ID`/`RUN_ID`; Task 2 gives `AppConfig.connectionId?: string | undefined`, `mappingId?`, `runId?`, and an `IBackendApiClient` with `getConnectionById` (no `getUserConnections`) and `reportRunError(mappingId, runId, error)`.
- Produces: `DownloaderService.run()` with no `CONNECTION_ID` and no `TEST_CONNECTION` throws (container exits 1 before the processor). With `CONNECTION_ID`, it downloads+converts exactly that connection to `<outputDir>/<connectionId>.csv`; an inactive or missing connection throws inside the per-connection handler, which reports `reportRunError(mappingId, runId, error)` when `MAPPING_ID`+`RUN_ID` are present and returns an `ERROR` summary (so `index.ts` exits 1 and the Dockerfile `&&` skips the processor).

### Step 3.1 — Replace the old full-mode `run()` with run-mode dispatch + `_runMappingConnection`

Make **one** replacement in `stocksprite/downloader/src/services/downloader-service.ts`.

The text to remove starts at the current line 30 and ends at the current line 142. Concretely, find this exact existing block (the whole current `run()` method, from the line `  public async run(): Promise<DownloaderExecutionSummary> {` down to the closing `  }` that sits immediately above the blank line before `  private async _runTestMode(connectionId: string)`):

```ts
  public async run(): Promise<DownloaderExecutionSummary> {
    const { userId, outputDir, testConnectionId } = this._config;

    // Check if running in single connection test mode
    if (testConnectionId) {
      return this._runTestMode(testConnectionId);
    }

    this._logger.info("Starting Downloader session", {
      userId,
      outputDir,
      backendUrl: this._config.backendUrl,
    });

    FileUtil.ensureDirExists(outputDir);

    const allConnections = await this._apiClient.getUserConnections(userId);
    const activeConnections = allConnections.filter((c) => c.isActive);

    this._logger.info("Retrieved user data connections", {
      total: allConnections.length,
      active: activeConnections.length,
    });

    if (activeConnections.length === 0) {
      this._logger.warn(
        allConnections.length === 0
          ? `No data connections configured for user '${userId}'.`
          : `User '${userId}' has ${allConnections.length} connection(s), but none are active (isActive = false).`,
        { userId, total: allConnections.length, active: activeConnections.length }
      );
    }

    const results: ConnectionProcessResult[] = [];

    for (const connection of activeConnections) {
      this._logger.info(`Processing connection '${connection.name}'`, {
        connectionId: connection.id,
        name: connection.name,
        channel: connection.channel,
        dataFormat: connection.dataFormat,
      });

      const rawFilePath = FileUtil.getRawFilePath(outputDir, connection.id, connection.dataFormat);
      const csvFilePath = FileUtil.getCsvFilePath(outputDir, connection.id);

      try {
        // Step 1: Download
        const downloader = this._downloaderFactory.getDownloader(connection.channel);
        const downloadResult = await downloader.download(connection, rawFilePath);

        // Step 2: Convert to Standardized CSV
        const converter = this._converterFactory.getConverter(connection.dataFormat);
        await converter.convert(connection, rawFilePath, csvFilePath);

        results.push({
          connectionId: connection.id,
          name: connection.name,
          channel: connection.channel,
          dataFormat: connection.dataFormat,
          status: "OK",
          isUnchanged: downloadResult.isUnchanged,
          rawFilePath,
          csvFilePath,
        });

        this._logger.info(`Successfully processed connection '${connection.name}' [ID: ${connection.id}]`, {
          connectionId: connection.id,
          csvFilePath,
          isUnchanged: downloadResult.isUnchanged,
        });
      } catch (error) {
        const errorMsg = ErrorUtil.stringifyError(error);
        this._logger.error(`Error processing connection '${connection.name}' [ID: ${connection.id}]`, {
          connectionId: connection.id,
          name: connection.name,
          error: errorMsg,
        });

        results.push({
          connectionId: connection.id,
          name: connection.name,
          channel: connection.channel,
          dataFormat: connection.dataFormat,
          status: "ERROR",
          error: errorMsg,
          rawFilePath,
          csvFilePath,
        });
      }
    }

    const successCount = results.filter((r) => r.status === "OK").length;
    const errorCount = results.filter((r) => r.status === "ERROR").length;

    const summary: DownloaderExecutionSummary = {
      userId,
      totalConnections: allConnections.length,
      activeConnections: activeConnections.length,
      successCount,
      errorCount,
      results,
    };

    const statusSummary = results.map((r) => `${r.name} (${r.connectionId}): ${r.status}`).join(", ");
    this._logger.info(`Downloader session completed. ${statusSummary}`, {
      userId,
      successCount,
      errorCount,
    });

    return summary;
  }
```

Delete exactly that block (nothing before line 30 and nothing after its final `  }`), and paste this in its place:

```ts
  public async run(): Promise<DownloaderExecutionSummary> {
    const { outputDir, testConnectionId, connectionId } = this._config;

    // Single-connection test mode (legacy) is unchanged and wins first.
    if (testConnectionId) {
      return this._runTestMode(testConnectionId);
    }

    FileUtil.ensureDirExists(outputDir);

    if (!connectionId) {
      const errorMsg =
        "Missing required environment variable: CONNECTION_ID (and no TEST_CONNECTION set)";
      this._logger.error("Downloader session aborted", { error: errorMsg });
      throw new Error(errorMsg);
    }

    this._logger.info("Starting Downloader session (single-connection mapping run)", {
      userId: this._config.userId,
      connectionId,
      outputDir,
      backendUrl: this._config.backendUrl,
    });

    return this._runMappingConnection(connectionId);
  }

  private async _runMappingConnection(
    connectionId: string
  ): Promise<DownloaderExecutionSummary> {
    const { userId, outputDir, mappingId, runId } = this._config;

    let connectionName = "Unknown";
    let channelType: DataConnectionChannel = "HTTP";
    let formatType: DataConnectionFormat = "CSV";

    try {
      // 1. Fetch the one connection this mapping run targets.
      const connection = await this._apiClient.getConnectionById(connectionId);
      connectionName = connection.name;
      channelType = connection.channel;
      formatType = connection.dataFormat;

      this._logger.info("Fetched connection for mapping run", {
        connectionId,
        name: connectionName,
        channel: channelType,
        dataFormat: formatType,
      });

      if (!connection.isActive) {
        throw new Error(
          `Connection '${connectionId}' is not active (isActive=false); refusing to download`
        );
      }

      const rawFilePath = FileUtil.getRawFilePath(outputDir, connectionId, connection.dataFormat);
      const csvFilePath = FileUtil.getCsvFilePath(outputDir, connectionId);

      // 2. Download the feed.
      const downloader = this._downloaderFactory.getDownloader(connection.channel);
      const downloadResult = await downloader.download(connection, rawFilePath);

      // 3. Convert to standardized CSV.
      const converter = this._converterFactory.getConverter(connection.dataFormat);
      await converter.convert(connection, rawFilePath, csvFilePath);

      this._logger.info(
        `Successfully processed connection '${connectionName}' [ID: ${connectionId}]`,
        { connectionId, csvFilePath, isUnchanged: downloadResult.isUnchanged }
      );

      return {
        userId,
        totalConnections: 1,
        activeConnections: 1,
        successCount: 1,
        errorCount: 0,
        results: [
          {
            connectionId,
            name: connectionName,
            channel: channelType,
            dataFormat: formatType,
            status: "OK",
            isUnchanged: downloadResult.isUnchanged,
            rawFilePath,
            csvFilePath,
          },
        ],
      };
    } catch (error) {
      const errorMsg = ErrorUtil.stringifyError(error);
      this._logger.error(`Error processing connection '${connectionName}' [ID: ${connectionId}]`, {
        connectionId,
        name: connectionName,
        error: errorMsg,
      });

      if (mappingId && runId) {
        try {
          await this._apiClient.reportRunError(mappingId, runId, errorMsg);
        } catch (reportErr) {
          this._logger.error("Failed to report mapping run error to backend", {
            mappingId,
            runId,
            error: ErrorUtil.stringifyError(reportErr),
          });
        }
      } else {
        this._logger.warn("Mapping run identity missing; skipping run-error report", {
          mappingId,
          runId,
        });
      }

      return {
        userId,
        totalConnections: 1,
        activeConnections: 0,
        successCount: 0,
        errorCount: 1,
        results: [
          {
            connectionId,
            name: connectionName,
            channel: channelType,
            dataFormat: formatType,
            status: "ERROR",
            error: errorMsg,
          },
        ],
      };
    }
  }
```

Result of Step 3.1: the file has one new `run()` plus a new private `_runMappingConnection`, and the old `run()` loop (including its `ConnectionProcessResult[]` local and every `getUserConnections` call) is gone. The blank line and the `private async _runTestMode(...)` line below the pasted block are untouched.

### Step 3.2 — Drop the now-unused `ConnectionProcessResult` import

In the same file, find this exact block near the top (currently lines 10–14):

```ts
import {
  IDownloaderService,
  DownloaderExecutionSummary,
  ConnectionProcessResult,
} from "../types/downloader-service.interface.js";
```

Replace it with:

```ts
import {
  IDownloaderService,
  DownloaderExecutionSummary,
} from "../types/downloader-service.interface.js";
```

`ConnectionProcessResult` is only referenced by the old `run()` you deleted in Step 3.1, so it is now an unused import and would fail lint if left.

### Step 3.3 — Verify build/lint (unit tests NOT yet run)

Run:

```bash
MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm run build && npm run lint'
```

Expected: build + lint green. Do NOT run `npm test` yet (Task 4 updates the unit tests).

---
## Task 4 — Downloader unit tests: drop full-mode coverage, add single-connection coverage

**Files:**
- Modify: `stocksprite/downloader/test/services/backend-api-client.test.ts`
- Modify: `stocksprite/downloader/test/services/downloader-service.test.ts`

**Interfaces:**
- Consumes: the Task 2 API client (no `getUserConnections`, new `reportRunError`) and the Task 3 service (config default `connectionId: "345"`; mapping-mode failures call `reportRunError`).
- Produces: a green downloader unit suite that exercises mapping mode and leaves the four existing test-mode tests untouched.

### Step 4.1 — Backend API client test: swap the two `getUserConnections` tests for two `reportRunError` tests

In `stocksprite/downloader/test/services/backend-api-client.test.ts`, find this exact block (the two tests that call `getUserConnections`, currently lines 28–63):

```ts
  it("should fetch user connections with x-internal-token header", async () => {
    const mockConnections: DataConnectionDto[] = [
      {
        id: "conn_1",
        name: "Cromwell",
        channel: "SFTP",
        dataFormat: "CSV",
        isActive: true,
        config: { channel: "SFTP", host: "sftp.test.com", remoteDir: "/" },
        dataFormatConfig: { format: "CSV", delimiter: "," },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { connections: mockConnections },
    });

    const result = await client.getUserConnections("user_test");

    expect(result).toEqual(mockConnections);
    expect(axios.get).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/users/user_test/connections",
      expect.objectContaining({
        headers: { "x-internal-token": "test_token" },
      })
    );
  });

  it("should throw formatted error when request fails", async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network Error"));

    await expect(client.getUserConnections("user_test")).rejects.toThrow("Failed to fetch user connections");
    expect(loggerMock.error).toHaveBeenCalled();
  });
```

Replace it with:

```ts
  it("should report a mapping run error via POST with the internal token", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ status: 200 });

    await client.reportRunError("map_1", "run_1", "boom");

    expect(axios.post).toHaveBeenCalledWith(
      "http://backend:3000/api/internal/stocksprite/mappings/map_1/progress",
      { runId: "run_1", progress: "error", error: "boom" },
      expect.objectContaining({ headers: { "x-internal-token": "test_token" } })
    );
  });

  it("should throw a formatted error when reporting a mapping run error fails", async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error("net down"));

    await expect(client.reportRunError("map_1", "run_1", "boom")).rejects.toThrow(
      "Failed to report run error for mapping 'map_1'"
    );
    expect(loggerMock.error).toHaveBeenCalled();
  });
```

Leave the file's other tests (getConnectionById success/missing, reportTestResult success/failure) and its imports unchanged. `vi.mocked(axios.post)` is used now; `axios.get` remains used by the surviving `getConnectionById` tests.

### Step 4.2 — Downloader service test: extend the shared config fixture

In `stocksprite/downloader/test/services/downloader-service.test.ts`, find this exact block (the config object built in `beforeEach`, currently lines 39–44):

```ts
    config = {
      userId: "user_mock",
      internalToken: "token_123",
      backendUrl: "http://backend:3000",
      outputDir: testDir,
    };
```

Replace it with:

```ts
    config = {
      userId: "user_mock",
      internalToken: "token_123",
      backendUrl: "http://backend:3000",
      outputDir: testDir,
      connectionId: "345",
      mappingId: "map_1",
      runId: "run_1",
    };
```

Every test now starts with a mapping-run identity (`345` / `map_1` / `run_1`). The existing test-mode tests set `config.testConnectionId`, which `run()` checks first, so they still exercise test mode.

### Step 4.3 — Downloader service test: replace the two full-mode tests with four mapping-run tests

In the same file, find this exact block (the two tests that orchestrate `getUserConnections`, currently lines 57–131):

```ts
  it("should orchestrate download and conversion for active connections", async () => {
    const mockConnections: DataConnectionDto[] = [
      {
        id: "345",
        name: "Madalbal",
        channel: "HTTP",
        dataFormat: "XML",
        isActive: true,
        config: { channel: "HTTP", url: "https://example.com/madalbal.xml" },
        dataFormatConfig: { format: "XML", rowPath: "product" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "inactive_conn",
        name: "Old Supplier",
        channel: "HTTP",
        dataFormat: "CSV",
        isActive: false,
        config: { channel: "HTTP", url: "https://example.com/old.csv" },
        dataFormatConfig: { format: "CSV", delimiter: "," },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    apiClientMock.getUserConnections.mockResolvedValue(mockConnections);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "345.raw.xml"),
      isUnchanged: false,
      byteCount: 500,
    });
    converterMock.convert.mockResolvedValue({
      outputPath: path.join(testDir, "345.csv"),
      rowCount: 10,
      byteCount: 300,
    });

    const summary = await service.run();

    expect(summary.totalConnections).toBe(2);
    expect(summary.activeConnections).toBe(1);
    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(summary.results[0].connectionId).toBe("345");
    expect(summary.results[0].rawFilePath).toBe(path.join(testDir, "345.raw.xml"));
    expect(summary.results[0].csvFilePath).toBe(path.join(testDir, "345.csv"));
  });

  it("should record errors and continue when a connection download fails", async () => {
    const mockConnections: DataConnectionDto[] = [
      {
        id: "2",
        name: "Broken Feed",
        channel: "HTTP",
        dataFormat: "CSV",
        isActive: true,
        config: { channel: "HTTP", url: "https://example.com/broken.csv" },
        dataFormatConfig: { format: "CSV", delimiter: ";" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    apiClientMock.getUserConnections.mockResolvedValue(mockConnections);
    downloaderMock.download.mockRejectedValue(new Error("Connection timed out"));

    const summary = await service.run();

    expect(summary.activeConnections).toBe(1);
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("Connection timed out");
  });
```

Replace it with these four tests:

```ts
  it("should download and convert the single mapped connection into 345.csv", async () => {
    const mockConn: DataConnectionDto = {
      id: "345",
      name: "Madalbal",
      channel: "HTTP",
      dataFormat: "XML",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/madalbal.xml" },
      dataFormatConfig: { format: "XML", rowPath: "product" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    apiClientMock.getConnectionById.mockResolvedValue(mockConn);
    downloaderMock.download.mockResolvedValue({
      destinationPath: path.join(testDir, "345.raw.xml"),
      isUnchanged: false,
      byteCount: 500,
    });
    converterMock.convert.mockResolvedValue({
      outputPath: path.join(testDir, "345.csv"),
      rowCount: 10,
      byteCount: 300,
    });

    const summary = await service.run();

    expect(apiClientMock.getConnectionById).toHaveBeenCalledWith("345");
    expect(summary.totalConnections).toBe(1);
    expect(summary.activeConnections).toBe(1);
    expect(summary.successCount).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(summary.results[0]).toMatchObject({
      connectionId: "345",
      name: "Madalbal",
      status: "OK",
      rawFilePath: path.join(testDir, "345.raw.xml"),
      csvFilePath: path.join(testDir, "345.csv"),
    });
  });

  it("should report a mapping run error when the download fails", async () => {
    const mockConn: DataConnectionDto = {
      id: "345",
      name: "Broken Feed",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: true,
      config: { channel: "HTTP", url: "https://example.com/broken.csv" },
      dataFormatConfig: { format: "CSV", delimiter: ";" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    apiClientMock.getConnectionById.mockResolvedValue(mockConn);
    downloaderMock.download.mockRejectedValue(new Error("Connection timed out"));

    const summary = await service.run();

    expect(apiClientMock.reportRunError).toHaveBeenCalledWith(
      "map_1",
      "run_1",
      expect.stringContaining("Connection timed out")
    );
    expect(summary.activeConnections).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("Connection timed out");
  });

  it("should refuse to download an inactive connection and report the run error", async () => {
    const mockConn: DataConnectionDto = {
      id: "345",
      name: "Old Supplier",
      channel: "HTTP",
      dataFormat: "CSV",
      isActive: false,
      config: { channel: "HTTP", url: "https://example.com/old.csv" },
      dataFormatConfig: { format: "CSV", delimiter: "," },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    apiClientMock.getConnectionById.mockResolvedValue(mockConn);

    const summary = await service.run();

    expect(downloaderMock.download).not.toHaveBeenCalled();
    expect(apiClientMock.reportRunError).toHaveBeenCalledWith(
      "map_1",
      "run_1",
      expect.stringContaining("not active")
    );
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("isActive=false");
  });

  it("should report a mapping run error when the mapped connection is missing", async () => {
    apiClientMock.getConnectionById.mockRejectedValue(new Error("Connection '345' not found"));

    const summary = await service.run();

    expect(apiClientMock.reportRunError).toHaveBeenCalledWith(
      "map_1",
      "run_1",
      expect.stringContaining("Connection '345' not found")
    );
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].name).toBe("Unknown");
    expect(summary.results[0].status).toBe("ERROR");
  });
```

### Step 4.4 — Downloader service test: replace the two full-mode unsupported-channel/format tests with mapping-run equivalents

In the same file, find this exact block (the two `getUserConnections`-based unsupported tests, currently lines 280–353):

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
```

Replace it with these two tests:

```ts
  it("should report a mapping run error when the connection uses an unsupported channel", async () => {
    config.connectionId = "ftp_1";

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

    apiClientMock.getConnectionById.mockResolvedValue(ftpConnection);

    const summary = await service.run();

    expect(apiClientMock.reportRunError).toHaveBeenCalledWith(
      "map_1",
      "run_1",
      expect.stringContaining("Unsupported download channel: 'FTP'")
    );
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("Unsupported download channel: 'FTP'");
  });

  it("should report a mapping run error when the connection uses an unsupported data format", async () => {
    config.connectionId = "json_1";

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

    apiClientMock.getConnectionById.mockResolvedValue(jsonConnection);

    const summary = await service.run();

    expect(apiClientMock.reportRunError).toHaveBeenCalledWith(
      "map_1",
      "run_1",
      expect.stringContaining("Unsupported data format: 'JSON'")
    );
    expect(summary.successCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.results[0].status).toBe("ERROR");
    expect(summary.results[0].error).toContain("Unsupported data format: 'JSON'");
  });
```

### Step 4.5 — Verify the downloader unit suite

Run:

```bash
MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm test'
```

Expected: **green**. The file `downloader-service.test.ts` now has 10 tests (the four existing test-mode tests plus the six new mapping-run tests) and `backend-api-client.test.ts` has 6; every test passes and nothing references `getUserConnections`.

---
## Task 5 — Integration harness: one `CONNECTION_ID` per run, single-connection WireMock contracts

**Files:**
- Delete (4): `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-all-protocols.json`, `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-malformed.json`, `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-bad-auth.json`, `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-404.json`
- Create (18): `stocksprite/downloader/test/integration/wiremock/mappings/backend-connection-*.json` (see Step 5.2 and 5.3 for exact names and contents)
- Modify: `stocksprite/downloader/test/integration/downloader.integration.test.ts` (full overwrite, Step 5.4)

**Interfaces:**
- Consumes: the Task 3 downloader in run mode requires `CONNECTION_ID` (no `TEST_CONNECTION`), calls `GET /api/internal/stocksprite/connections/:id`, and treats HTTP 404 / inactive / download / convert failures as a single-connection error (exit 1).
- Produces: a WireMock contract set on the new single-connection endpoint and a 17-run integration suite (12 happy single-connection runs + 5 negatives). The mock-backend image COPYs `mappings/` at build time, so the suite's `beforeAll` (`docker compose ... up -d --build mock-backend mock-datasource-server`) bakes the new mapping files in.

> Why these files exist: the old mappings answered `GET /users/:userId/connections` with an ARRAY (`"connections": [...]`) and drove one full-mode run that processed all of them. The downloader no longer calls that endpoint, so every mapping must be replaced with a single-connection contract on `GET /api/internal/stocksprite/connections/<id>` returning an OBJECT (`"connection": {...}`).

### Step 5.1 — Delete the four obsolete mapping files

Delete these four files (whole files):

1. `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-all-protocols.json`
2. `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-malformed.json`
3. `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-bad-auth.json`
4. `stocksprite/downloader/test/integration/wiremock/mappings/backend-user-404.json`

### Step 5.2 — Create the twelve happy-path single-connection mapping files

Create each of these twelve files at `stocksprite/downloader/test/integration/wiremock/mappings/` with **exactly** the content given. Each returns the same connection object the old list returned, wrapped as `{ "connection": {...} }` under a `GET /api/internal/stocksprite/connections/<id>` request. Copy byte-for-byte (indentation, quoting); do not add `createdAt`/`updatedAt` — the old objects never had them and the downloader accepts them absent.

File **`backend-connection-http-public-comma.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_public_comma"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_public_comma",
        "name": "HTTP Public Comma Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_public_comma.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-http-pipe.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_pipe"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_pipe",
        "name": "HTTP Pipe Delimited Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_pipe.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": "|"
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-http-semicolon.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_semicolon"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_semicolon",
        "name": "HTTP Semicolon Delimited Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_semicolon.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ";"
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-http-bearer.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_bearer"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_bearer",
        "name": "HTTP Bearer Auth Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/bearer/feed_bearer.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "BEARER",
          "token": "mock_bearer_token_123"
        }
      }
    }
  }
}
```

File **`backend-connection-http-apikey.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_apikey"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_apikey",
        "name": "HTTP API Key Auth Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/apikey/feed_apikey.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "API_KEY",
          "headerName": "X-Supplier-API-Key",
          "headerValue": "mock_api_key_456"
        }
      }
    }
  }
}
```

File **`backend-connection-http-basic.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_basic"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_basic",
        "name": "HTTP Basic Auth Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/basic/feed_basic.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "BASIC",
          "username": "supplier_user",
          "password": "supplier_pass"
        }
      }
    }
  }
}
```

File **`backend-connection-http-xml.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_xml"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_xml",
        "name": "HTTP XML Product Catalog Feed",
        "channel": "HTTP",
        "dataFormat": "XML",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_catalog.xml"
        },
        "dataFormatConfig": {
          "format": "XML",
          "rowPath": "products/product"
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-sftp-password.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_sftp_password"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_sftp_password",
        "name": "SFTP Password Auth Feed",
        "channel": "SFTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "SFTP",
          "host": "mock-datasource-server",
          "port": 22,
          "remoteDir": "/home/sftpuser/upload"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "PASSWORD",
          "username": "sftpuser",
          "password": "sftppass"
        }
      }
    }
  }
}
```

File **`backend-connection-sftp-key.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_sftp_key"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_sftp_key",
        "name": "SFTP SSH Key Auth Feed",
        "channel": "SFTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "SFTP",
          "host": "mock-datasource-server",
          "port": 22,
          "remoteDir": "/home/keyuser/upload"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "PRIVATE_KEY",
          "username": "keyuser",
          "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAQEA2ourNaXOAGFfPlOYTN/Uxm24svY2OQoy3m2mNgkwn5ecopFL5KeJ\nYQMzkLqnYsRNrryTTPy4xe16pOUlAkn1/5TCMFhi3YcGW876Pa5YYyuRCn4c1KOjhaU+O2\nMledpTA4A51dl9e/C/n4KZPj2PFXBYFRt6mLPK4hOg4Ey0LhvaPkereAkrBqAPhtA+9CO5\ncJIUuUmz1S08T/n8ddEUir5ov2VB3DVXjpHZ895ImK8gxcqPCzDFXg4G2gxjNXZJzHD67T\nIaEoNPgfMTgC90fdTCgTz8JCdxShxchIK4ZTRG6jrUHeov2pjfFX7Cl3AcvP0iVHpjKfBg\nqru3WrvNQQAAA9DO5SSEzuUkhAAAAAdzc2gtcnNhAAABAQDai6s1pc4AYV8+U5hM39TGbb\niy9jY5CjLebaY2CTCfl5yikUvkp4lhAzOQuqdixE2uvJNM/LjF7Xqk5SUCSfX/lMIwWGLd\nhwZbzvo9rlhjK5EKfhzUo6OFpT47YyV52lMDgDnV2X178L+fgpk+PY8VcFgVG3qYs8riE6\nDgTLQuG9o+R6t4CSsGoA+G0D70I7lwkhS5SbPVLTxP+fx10RSKvmi/ZUHcNVeOkdnz3kiY\nryDFyo8LMMVeDgbaDGM1dknMcPrtMhoSg0+B8xOAL3R91MKBPPwkJ3FKHFyEgrhlNEbqOt\nQd6i/amN8VfsKXcBy8/SJUemMp8GCqu7dau81BAAAAAwEAAQAAAQEApYtEvleBKuKXTdPu\nutSWDVTRoqZEPoLOM5SlYasmbM1gdfhPn72Un6rYJZpt7q+6FFF91sRchnkz/LIijZBOyj\nH5wrtA8IM2OtcW0SA+jahTrroGxr/JvxODh2K74YiSd0VrCeU8W2TrEj3QLMhemSPHZP2y\nqPcQCJ5Lr3wKxB0oQJcz69oXywHHKMCdCy5LDf+A/KI93rcCeyA3/i5iqVtCZEBu1PMbft\nZGW8o8P1F6ccFG1M5rrut/RQpYCzSJSrjLDSmn+EB8k2bx2HEdzqL0kGDBqQxW8O+61pTs\nCSt/WrmhZ0Wwe0OhmX9IPgMcmOsRV/NXszFDTBjP8t0bQQAAAIEA4hmmWo3z/+nJLKyT10\nJTmIEgNaWXJEYqVBv1xMFqAa8VFyKyPl2Qdb+bIVdp4aZsSnWY5t3PZGGTZMoj48JvpCW0\nKjY3SJDazQLddoWl9RdFUiUTlb9JL7SCSoqUZLrdzekWjbejBso78lyXTvUy3y4y5ufCuG\nx/VOAXwHyfD0sAAACBAPfg33pcKBQgYepLCR0FQTUi2FV0Ocl2kWOy0aWOQPZxXPleUhMM\nBW2KIFCipl3zW0xoUJXg4Lbsnsx5zzDRTjorjmfEOrteP8DjCWDC8u764e5jov4/NJj6OG\nY5ANgJmimIAg/XZmLniZZXEJX9T/TrpuG1NpuTnkevUWaXDJcZAAAAgQDhtMLcjrIeKOBQ\n9eoYyomvKRK7ufC4JHIUfoMb9HKpojo/7GsTRMh956jJGgRKndSzH4ImJIPhQy/sA+nQ14\n2E13WQ5XsB5GaEHew0ANJnOLzsXc60X+MfM5InzH8AOKlsNFto2HUgI7a2GUYE+GqOE8oY\nCF9oEd+FVdg/kr70aQAAABNuZ2Fib0BnYWJvci1sYXB0b3AyAQIDBAUG\n-----END OPENSSH PRIVATE KEY-----"
        }
      }
    }
  }
}
```

File **`backend-connection-http-win1250.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_win1250"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_win1250",
        "name": "HTTP Windows-1250 Hungarian Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_win1250.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ",",
          "encoding": "windows-1250"
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-http-utf8-bom.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_utf8_bom"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_utf8_bom",
        "name": "HTTP UTF-8-BOM Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_utf8_bom.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ",",
          "encoding": "UTF-8-BOM"
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-http-iso88592.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_http_iso88592"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_http_iso88592",
        "name": "HTTP ISO-8859-2 Latin-2 Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_iso88592.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": "|",
          "encoding": "ISO-8859-2"
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

### Step 5.3 — Create the six negative/fallback single-connection mapping files

Create each of these six files in the same `.../wiremock/mappings/` directory with **exactly** the content given.

File **`backend-connection-malformed.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_malformed_xml"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_malformed_xml",
        "name": "HTTP Malformed XML Feed",
        "channel": "HTTP",
        "dataFormat": "XML",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_malformed.xml"
        },
        "dataFormatConfig": {
          "format": "XML",
          "rowPath": "products/product"
        },
        "isActive": true,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-bad-bearer.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_bad_bearer"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_bad_bearer",
        "name": "HTTP Bad Bearer Auth",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/bearer/feed_bearer.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "BEARER",
          "token": "invalid_wrong_token"
        }
      }
    }
  }
}
```

File **`backend-connection-bad-sftp.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_bad_sftp"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_bad_sftp",
        "name": "SFTP Bad Password Auth",
        "channel": "SFTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "SFTP",
          "host": "mock-datasource-server",
          "port": 22,
          "remoteDir": "/home/sftpuser/upload"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ","
        },
        "isActive": true,
        "credentials": {
          "authType": "PASSWORD",
          "username": "sftpuser",
          "password": "wrong_incorrect_password"
        }
      }
    }
  }
}
```

File **`backend-connection-missing.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_missing"
  },
  "response": {
    "status": 404,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "error": "Connection 'conn_missing' not found"
    }
  }
}
```

File **`backend-connection-inactive.json`**:

```json
{
  "request": {
    "method": "GET",
    "url": "/api/internal/stocksprite/connections/conn_inactive"
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "connection": {
        "id": "conn_inactive",
        "name": "Inactive Supplier Feed",
        "channel": "HTTP",
        "dataFormat": "CSV",
        "config": {
          "channel": "HTTP",
          "url": "http://mock-datasource-server:80/public/feed_semicolon.csv"
        },
        "dataFormatConfig": {
          "format": "CSV",
          "delimiter": ";"
        },
        "isActive": false,
        "credentials": {
          "authType": "NONE"
        }
      }
    }
  }
}
```

File **`backend-connection-404-fallback.json`** (catches any connection id not stubbed above; WireMock scores the exact `url` mappings higher, so the twelve happy ids and the negatives still hit their own files):

```json
{
  "request": {
    "method": "GET",
    "urlPattern": "/api/internal/stocksprite/connections/.*"
  },
  "response": {
    "status": 404,
    "headers": {
      "Content-Type": "application/json"
    },
    "jsonBody": {
      "error": "Connection not found"
    }
  }
}
```

### Step 5.4 — Overwrite the integration test file

Overwrite `stocksprite/downloader/test/integration/downloader.integration.test.ts` with:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const COMPOSE_FILE = path.resolve(__dirname, "docker-compose-test-integration.yaml");
// /workspace inside the dev container; repo root when run from the host.
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const TEST_INTEGRATION_DIR = __dirname;
const TEMP_DIR = path.resolve(__dirname, "temp");
// The mock services publish their HTTP ports on the Docker host. When this suite
// runs from the host, that host is reached via 127.0.0.1. When it runs inside the
// stocksprite-dev container, the host is reached via host.docker.internal
// (baked into the image as MOCK_HOST).
const MOCK_HOST = process.env.MOCK_HOST || "127.0.0.1";

function cleanTempDir(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Probe the datasource mock's sshd by reading its SSH banner from the host-published
// port 2224. A bare TCP connect can succeed via docker-proxy before sshd inside the
// container is actually accepting, so wait for the "SSH-2.0-..." identification
// string instead. Mirrors the HTTP readiness probes on 8088/8089.
function sshdIsReady(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(2224, host);
    let settled = false;
    const done = (ready: boolean): void => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(ready);
      }
    };
    socket.setTimeout(2000);
    socket.once("data", (chunk: Buffer) => done(chunk.toString().startsWith("SSH-2.0-")));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

// A mapping run: the container is booted with CONNECTION_ID (plus USER_ID etc.) and
// downloads/converts exactly that one connection to <OUTPUT_DIR>/<CONNECTION_ID>.csv.
function baseEnv(connectionId: string): Record<string, string> {
  return {
    USER_ID: "integration_runner",
    INTERNAL_TOKEN: "mock_internal_token",
    BACKEND_URL: "http://mock-backend:8080",
    OUTPUT_DIR: "/app/temp",
    CONNECTION_ID: connectionId,
  };
}

function runDownloaderContainer(
  env: Record<string, string>
): { exitCode: number; stdout: string; stderr: string } {
  const containerName = `storesprite-dl-int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Do NOT bind-mount the temp dir into the container: this harness runs from
  // inside the stocksprite-dev container against the HOST Docker engine, which
  // resolves bind sources in its own namespace. A /workspace/... source would
  // mount an empty directory there, so the downloader's output would never reach
  // the host temp dir the assertions read. Instead run a named container, read
  // its exit code, `docker cp` the produced files back out, then remove it.
  const dockerArgs: string[] = [
    "run",
    "--name",
    containerName,
    "--network",
    "storesprite-integration-net",
  ];
  for (const [key, value] of Object.entries(env)) {
    dockerArgs.push("-e", `${key}=${value}`);
  }
  dockerArgs.push("storesprite-downloader:test-integration");

  const run = spawnSync("docker", dockerArgs, {
    encoding: "utf-8",
    cwd: REPO_ROOT,
  });

  try {
    // Pull the downloader's output (converted CSVs + downloader.log) out of the
    // container's filesystem into the temp dir the assertions read below.
    spawnSync("docker", ["cp", `${containerName}:/app/temp/.`, TEMP_DIR], {
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
  } finally {
    spawnSync("docker", ["rm", "-f", containerName], {
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
  }

  return {
    exitCode: run.status ?? 1,
    stdout: run.stdout || "",
    stderr: run.stderr || "",
  };
}

describe("StoreSprite Downloader Container Integration Test Suite", () => {
  beforeAll(async () => {
    cleanTempDir();

    // 1. Build the downloader-only runtime image (production Dockerfile, `--target downloader-runtime`).
    //    DOCKER_BUILDKIT=1 ensures the target's ancestor stages are pruned (the legacy builder
    //    would otherwise also run the unrelated `packages` stage and fail).
    console.log("[Integration Test] Building storesprite-downloader:test-integration image...");
    execSync(
      "docker build --target downloader-runtime -t storesprite-downloader:test-integration -f stocksprite/Dockerfile .",
      {
        cwd: REPO_ROOT,
        env: { ...process.env, DOCKER_BUILDKIT: "1", BUILDKIT_PROGRESS: "plain" },
        stdio: "inherit",
      }
    );

    // 2. Start mock-backend and mock-datasource-server services (rebuilding mock-backend
    //    so the new single-connection WireMock mappings in wiremock/mappings are baked in).
    console.log("[Integration Test] Starting mock-backend and mock-datasource-server services via docker-compose...");
    execSync(`docker compose -f "${COMPOSE_FILE}" up -d --build mock-backend mock-datasource-server`, {
      cwd: TEST_INTEGRATION_DIR,
      stdio: "inherit",
    });

    // 3. Poll for mock-backend (WireMock health), the datasource nginx (public CSV)
    //    and the datasource sshd (SSH banner) until all are ready. Two of the twelve
    //    happy-path feeds are SFTP, so the downloader container must not launch until
    //    sshd accepts connections, not just until HTTP answers.
    console.log("[Integration Test] Waiting for mock services to be ready...");
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const [resBackend, resSupplier, sshReady] = await Promise.all([
          fetch(`http://${MOCK_HOST}:8089/__admin/health`),
          fetch(`http://${MOCK_HOST}:8088/public/feed_public_comma.csv`),
          sshdIsReady(MOCK_HOST),
        ]);
        if (resBackend.status === 200 && resSupplier.status === 200 && sshReady) {
          ready = true;
          break;
        }
      } catch {
        // Wait and retry
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!ready) {
      throw new Error("Mock services (WireMock or Nginx) failed to become ready within timeout.");
    }
    console.log("[Integration Test] Mock services are healthy and responding.");
  }, 120000);

  afterAll(() => {
    console.log("[Integration Test] Tearing down mock services...");
    try {
      execSync(`docker compose -f "${COMPOSE_FILE}" down`, {
        cwd: TEST_INTEGRATION_DIR,
        stdio: "inherit",
      });
    } catch {
      // Ignored during teardown
    }
  });

  const happyPathCases: Array<{ id: string; assertCsv: (content: string) => void }> = [
    {
      id: "conn_http_public_comma",
      assertCsv: (content) => {
        expect(content).toContain("PROD-001;Tool Set A;19.99;150");
      },
    },
    {
      id: "conn_http_pipe",
      assertCsv: (content) => {
        expect(content).toContain("PIPE-101;Heavy Hammer;12.99;80");
      },
    },
    {
      id: "conn_http_semicolon",
      assertCsv: (content) => {
        expect(content).toContain("SEMI-201;Screwdriver Set;15.00;95");
      },
    },
    {
      id: "conn_http_bearer",
      assertCsv: (content) => {
        expect(content).toContain("BEARER-301;Safety Goggles;6.50;500");
      },
    },
    {
      id: "conn_http_apikey",
      assertCsv: (content) => {
        expect(content).toContain("APIKEY-401;Cordless Screwdriver;45.00;30");
      },
    },
    {
      id: "conn_http_basic",
      assertCsv: (content) => {
        expect(content).toContain("BASIC-501;Toolbox Metal 3-Tier;38.50;25");
      },
    },
    {
      id: "conn_http_xml",
      assertCsv: (content) => {
        expect(content).toContain("XML-601");
        expect(content).toContain("Digital Caliper 150mm");
      },
    },
    {
      id: "conn_sftp_password",
      assertCsv: (content) => {
        expect(content).toContain("SFTP-701;Hex Key Set 9pc;14.50;110");
      },
    },
    {
      id: "conn_sftp_key",
      assertCsv: (content) => {
        expect(content).toContain("SFTP-701;Hex Key Set 9pc;14.50;110");
      },
    },
    {
      id: "conn_http_win1250",
      assertCsv: (content) => {
        expect(content).toContain("Cikkszám;Terméknév;Ár;Készlet");
        expect(content).toContain("HU-901;Árvíztűrő tükörfúrógép;14990;25");
        expect(content).toContain("HU-902;Ütvefúró és vésőgép;28500;10");
      },
    },
    {
      id: "conn_http_utf8_bom",
      assertCsv: (content) => {
        expect(content.charCodeAt(0)).not.toBe(0xfeff);
        expect(content).toContain("sku;megnevezés;ár;raktár");
        expect(content).toContain("BOM-101;Láncfűrész fém fogazattal;34990;12");
      },
    },
    {
      id: "conn_http_iso88592",
      assertCsv: (content) => {
        expect(content).toContain("Azonosító;Megnevezés;Egységár;Raktár");
        expect(content).toContain("ISO-001;Csavarhúzó készlet (9 részes);4500;85");
      },
    },
  ];

  describe("single-connection mapping runs (Happy Path)", () => {
    it.each(
      happyPathCases.map(
        ({ id, assertCsv }) => [id, assertCsv] as [string, (content: string) => void]
      )
    )("downloads and converts the one mapped connection %s", (id, assertCsv) => {
      cleanTempDir();

      const { exitCode, stdout, stderr } = runDownloaderContainer(baseEnv(id));

      console.log(`[Integration Test Output - ${id}]:\n` + stdout);
      // Embed the downloader's own output in the failure so a flaky/non-zero run is
      // self-diagnosing: the session summary + "Error processing connection ..." lines
      // name the exact connection that failed instead of vanishing with the temp dir.
      expect(
        exitCode,
        `downloader exited ${exitCode} (expected 0).\n--- stdout (tail) ---\n${stdout.slice(-8000)}${
          stderr ? `\n--- stderr (tail) ---\n${stderr.slice(-2000)}` : ""
        }`
      ).toBe(0);
      expect(stdout).toContain("Downloader completed successfully without errors");

      // The converted output must be exactly <connectionId>.csv (single-connection run).
      const csvPath = path.join(TEMP_DIR, `${id}.csv`);
      const files = fs.readdirSync(TEMP_DIR);
      expect(
        fs.existsSync(csvPath),
        `expected ${csvPath} to exist. temp/ contains: ${files.join(", ")}`
      ).toBe(true);
      assertCsv(fs.readFileSync(csvPath, "utf-8"));
    }, 60000);
  });

  const negativeCases: Array<{ id: string; label: string }> = [
    { id: "conn_malformed_xml", label: "Malformed XML" },
    { id: "conn_bad_bearer", label: "Bad Bearer token" },
    { id: "conn_bad_sftp", label: "Bad SFTP password" },
    { id: "conn_missing", label: "Connection not found (404)" },
    { id: "conn_inactive", label: "Inactive connection" },
  ];

  describe("negative single-connection runs", () => {
    it.each(negativeCases.map(({ id, label }) => [id, label] as [string, string]))(
      "%s exits 1 and logs the per-connection error (%s)",
      (id, label) => {
        cleanTempDir();

        const { exitCode, stdout, stderr } = runDownloaderContainer(baseEnv(id));

        console.log(`[Integration Test Output - ${label}]:\n` + stdout);
        expect(
          exitCode,
          `downloader exited ${exitCode} (expected 1).\n--- stdout (tail) ---\n${stdout.slice(-8000)}${
            stderr ? `\n--- stderr (tail) ---\n${stderr.slice(-2000)}` : ""
          }`
        ).toBe(1);
        expect(stdout).toContain("Downloader finished with errors");
        expect(stdout).toContain("Error processing connection");
      },
      60000
    );
  });
});
```

### Step 5.5 — Verify the integration suite

Run (this builds the downloader image and starts the WireMock/nginx/sshd mocks, then runs 17 containers — allow several minutes):

```bash
MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm run test:integration'
```

Expected: **green** — 17 integration tests pass (12 happy single-connection runs + 5 negative runs). Each happy run exits 0, prints "Downloader completed successfully without errors", and produces exactly `<connectionId>.csv` with the expected standardized rows; each negative run exits 1 and prints "Error processing connection" + "Downloader finished with errors".

---
## Task 6 — Documentation: single-connection worker contract

**Files:**
- Modify: `C:\my-git\storesprite\AGENTS.md` (5 edits)
- Modify: `C:\my-git\storesprite\stocksprite\readme.md` (4 edits)

**Interfaces:**
- Consumes: the worker↔backend contract changed in Tasks 1–3 (workers fetch one connection by id; mapping runs inject `CONNECTION_ID`; downloader refuses inactive/missing connections and exits 1).
- Produces: docs that no longer describe the removed full-mode "fetch every active connection" behavior.

> All snippets below are literal doc text. When a snippet contains ``` fences of its own, copy exactly what is inside the ````...```` block. Do not renumber other lists in these files beyond what the snippet shows.

### Step 6.1 — AGENTS.md: update the internal-endpoints phrase (two places, identical wording)

In `C:\my-git\storesprite\AGENTS.md`, replace **all** occurrences (there are exactly 2) of the phrase:

`workers fetch tenant connections (`/users/:userId/connections`) and mapping run-configs (`/mappings/:mappingId/run-config`), and report run progress`

with:

`workers fetch the single connection a job targets (`/connections/:connectionId`) and mapping run-configs (`/mappings/:mappingId/run-config`), and report run progress`

The two sites are the "Security Boundaries & Endpoints" bullet in the System Components list (component 2) and the "Security Routes" bullet in Section 1's architecture overview. Do NOT expect zero `:userId/connections` matches yet — Steps 6.3 and 6.5 remove the remaining occurrences. The zero-match check belongs at the end of Step 6.5.

### Step 6.2 — AGENTS.md: Worker Orchestrator env list (System Components)

In `C:\my-git\storesprite\AGENTS.md`, find this exact line (the **Worker Orchestrator** bullet in the System Components list):

````markdown
   * **Worker Orchestrator**: Spawns an ephemeral `stocksprite` container (downloader → processor) per job, injecting `USER_ID` / `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, and `BACKEND_URL`.
````

Replace that whole line with:

````markdown
   * **Worker Orchestrator**: Spawns an ephemeral `stocksprite` container (downloader → processor) per job, injecting `USER_ID`, `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, and `BACKEND_URL`.
````

### Step 6.3 — AGENTS.md: Execution Lifecycle block (System Components)

In `C:\my-git\storesprite\AGENTS.md`, find this exact block:

````markdown
   * **Execution Lifecycle** (booted on-demand by `storesprite-be` with `USER_ID` /
     `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`):
     1. `downloader` (`stocksprite/downloader`): Fetches the tenant's active supplier
        connections from `storesprite-be` (`GET /api/internal/stocksprite/users/:userId/connections`,
        guarded by `x-internal-token`), stream-downloads each feed (HTTP/SFTP, all auth
        schemes), and converts it in-place to standardized `;`-delimited CSV — `csvkit`
        for CSV delimiters/encodings, a streaming SAX parser for XML — under `temp/`.
````

Replace it with:

````markdown
   * **Execution Lifecycle** (booted on-demand by `storesprite-be` with `USER_ID`,
     `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`):
     1. `downloader` (`stocksprite/downloader`): Fetches the run's one connection from
        `storesprite-be` (`GET /api/internal/stocksprite/connections/:connectionId`,
        guarded by `x-internal-token`), refuses an inactive or missing connection, and
        otherwise stream-downloads that feed (HTTP/SFTP, all auth schemes) and converts
        it in-place to standardized `;`-delimited CSV — `csvkit` for CSV
        delimiters/encodings, a streaming SAX parser for XML — under `temp/<connectionId>.csv`.
````

### Step 6.4 — AGENTS.md: Orchestrator env list (Section 1 overview)

In `C:\my-git\storesprite\AGENTS.md`, find this exact line:

````markdown
    *   **Orchestrator**: Spawns and manages on-demand `stocksprite` container instances per tenant (injecting `USER_ID` / `MAPPING_ID` + `RUN_ID`, and `INTERNAL_TOKEN`).
````

Replace that whole line with:

````markdown
    *   **Orchestrator**: Spawns and manages on-demand `stocksprite` container instances per tenant (injecting `USER_ID`, `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, and `INTERNAL_TOKEN`).
````

### Step 6.5 — AGENTS.md: on-demand boot bullets (Section 1 overview)

In `C:\my-git\storesprite\AGENTS.md`, find this exact two-line block:

````markdown
        1. Booted by `storesprite-be` with `USER_ID` / `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`.
        2. `downloader` fetches the tenant's active supplier connections from `storesprite-be`, stream-downloads each feed (HTTP/SFTP) and converts it to standardized CSV (`temp/<connectionId>.csv`).
````

Replace it with:

````markdown
        1. Booted by `storesprite-be` with `USER_ID`, `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`.
        2. `downloader` fetches the run's one connection by id from `storesprite-be` (`GET .../connections/:connectionId`), refuses an inactive or missing connection, and otherwise stream-downloads that feed (HTTP/SFTP) and converts it to standardized CSV (`temp/<connectionId>.csv`).
````

Verify (final for AGENTS.md): search `:userId/connections` and `tenant connections` in `C:\my-git\storesprite\AGENTS.md` — both must return **0** matches now.

### Step 6.6 — stocksprite/readme.md: §1 responsibility item 1

In `C:\my-git\storesprite\stocksprite\readme.md`, find this exact line:

````markdown
1. **Fetches Configuration**: Accepts a `USER_ID`, calls `storesprite-be` (`GET /api/internal/stocksprite/users/:userId/connections` with `x-internal-token`), and filters for `isActive: true` connections.
````

Replace it with:

````markdown
1. **Fetches Configuration**: Accepts a `CONNECTION_ID` (plus `USER_ID` for context/logging), calls `storesprite-be` (`GET /api/internal/stocksprite/connections/:connectionId` with `x-internal-token`), and refuses to run when that connection is inactive or missing.
````

### Step 6.7 — stocksprite/readme.md: §3 run example gains `CONNECTION_ID`

In `C:\my-git\storesprite\stocksprite\readme.md`, find this exact fenced block under "### Run the Container (Cloud Run Job / Local Container)":

````markdown
```bash
docker run --rm \
  --network storesprite-shared-net \
  -e USER_ID="user_3Hgss1Pn9eF6eXyIf53rKLieGJp" \
  -e INTERNAL_TOKEN="mock_worker_token" \
  -e BACKEND_URL="http://storesprite-be:3000" \
  -e OUTPUT_DIR="/app/temp" \
  -v C:\my-git\storesprite\stocksprite\downloader\temp:/app/temp \
  storesprite-downloader
```
````

Replace it with:

````markdown
```bash
docker run --rm \
  --network storesprite-shared-net \
  -e USER_ID="user_3Hgss1Pn9eF6eXyIf53rKLieGJp" \
  -e CONNECTION_ID="345" \
  -e INTERNAL_TOKEN="mock_worker_token" \
  -e BACKEND_URL="http://storesprite-be:3000" \
  -e OUTPUT_DIR="/app/temp" \
  -v C:\my-git\storesprite\stocksprite\downloader\temp:/app/temp \
  storesprite-downloader
```

> `CONNECTION_ID` selects the single feed to download and convert (to `temp/345.csv`). A
> mapping run also injects `MAPPING_ID` + `RUN_ID` so a failure is reported to the
> backend run history before the container exits non-zero. A connection test sets
> `TEST_CONNECTION` instead and omits `CONNECTION_ID`.
````

### Step 6.8 — stocksprite/readme.md: §4 WireMock bullet

In `C:\my-git\storesprite\stocksprite\readme.md`, find this exact bullet:

````markdown
* **WireMock (`mock-backend`)**: Mocks `storesprite-be` connection retrieval endpoints (`GET /api/internal/stocksprite/users/:userId/connections`).
````

Replace it with:

````markdown
* **WireMock (`mock-backend`)**: Mocks `storesprite-be` single-connection retrieval (`GET /api/internal/stocksprite/connections/:connectionId`).
````

### Step 6.9 — stocksprite/readme.md: §4 Scenarios Covered

In `C:\my-git\storesprite\stocksprite\readme.md`, find this exact block (from the `#### Scenarios Covered:` heading through the 404 bullet; do not touch the `#### Running Integration Tests:` heading below it):

````markdown
#### Scenarios Covered:
1. **Happy Path (12 Combinations: 9 Protocols/Auth + 3 Encodings)**:
   - HTTP Public (Comma Delimited CSV)
   - HTTP Pipe Delimited CSV
   - HTTP Semicolon Delimited CSV
   - HTTP Bearer Token Auth CSV
   - HTTP API Key Header (`X-Supplier-API-Key`) CSV
   - HTTP Basic Auth (`.htpasswd`) CSV
   - HTTP XML Product Catalog (`<catalog><product>...`) converted via SAX to standardized CSV
   - SFTP Username & Password Auth CSV
   - SFTP SSH Private Key (`id_rsa` / `id_rsa.pub`) Auth CSV
   - HTTP Windows-1250 (Hungarian) CSV, converted to UTF-8
   - HTTP UTF-8 with BOM CSV, BOM stripped
   - HTTP ISO-8859-2 (Latin-2) CSV, converted to UTF-8
2. **Negative Test: Malformed XML**:
   - Asserts downstream XML parser catches broken XML syntax and completes with error summary.
3. **Negative Test: Invalid Authentication**:
   - Asserts HTTP 401 Bearer Token and SFTP password failures are captured, logged, and isolated.
4. **Negative Test: 404 User Not Found**:
   - Asserts downloader terminates immediately with exit code 1 when backend returns 404.
````

Replace it with:

````markdown
#### Scenarios Covered:
1. **Happy Path — 12 Single-Connection Mapping Runs (9 Protocols/Auth + 3 Encodings)**:
   Each run injects one `CONNECTION_ID` and converts that connection's feed to `<connectionId>.csv`:
   - HTTP Public (Comma Delimited CSV)
   - HTTP Pipe Delimited CSV
   - HTTP Semicolon Delimited CSV
   - HTTP Bearer Token Auth CSV
   - HTTP API Key Header (`X-Supplier-API-Key`) CSV
   - HTTP Basic Auth (`.htpasswd`) CSV
   - HTTP XML Product Catalog (`<catalog><product>...`) converted via SAX to standardized CSV
   - SFTP Username & Password Auth CSV
   - SFTP SSH Private Key (`id_rsa` / `id_rsa.pub`) Auth CSV
   - HTTP Windows-1250 (Hungarian) CSV, converted to UTF-8
   - HTTP UTF-8 with BOM CSV, BOM stripped
   - HTTP ISO-8859-2 (Latin-2) CSV, converted to UTF-8
2. **Negative Test: Malformed XML**:
   - Asserts the streaming XML parser catches broken XML syntax; the single-connection run exits 1 with an error summary.
3. **Negative Test: Invalid Authentication** (two runs):
   - Asserts HTTP bad Bearer token and SFTP bad password failures are captured, logged, and isolated; each run exits 1.
4. **Negative Test: Connection Not Found**:
   - Asserts the run exits 1 when the backend returns 404 for the mapped connection id.
5. **Negative Test: Inactive Connection**:
   - Asserts the downloader refuses an `isActive: false` connection and exits 1.
````

### Step 6.10 — Verify docs-only change with host git status

Run (on the host, from `C:\my-git\storesprite`):

```bash
git status --short
```

Expected: the working tree shows exactly the source/test/doc edits from Tasks 1–6 — the backend interface + runner + scheduler + their tests, the downloader config/interface/client/service + their tests, the new WireMock mapping files, the deleted old mapping files, the integration test, `AGENTS.md`, and `stocksprite/readme.md`. There must be **no commit** (nothing to do — you never run `git commit`), and `node_modules`/`dist` must not appear (they live only in containers).

---
## Verification (end-to-end)

Run all four gates after Task 6. Every one must come back green:

```bash
MSYS_NO_PATHCONV=1 docker exec storesprite-be sh -c 'cd /workspace/storesprite-be && npm test && npm run test:integration && npm run build && npm run lint'
MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm test && npm run build && npm run lint'
MSYS_NO_PATHCONV=1 docker exec stocksprite-dev sh -c 'cd /workspace/stocksprite/downloader && npm run test:integration'
```

Expected:
1. Backend: green — scheduler + connection-test-runner unit tests pass with the new 6-arg `runMapping`; build + lint clean.
2. Downloader unit + build + lint: green — `downloader-service.test.ts` runs 10 tests and `backend-api-client.test.ts` runs 6; no reference to `getUserConnections` anywhere.
3. Downloader integration: green — 17 tests (12 happy single-connection runs + 5 negatives).

Nothing is committed unless the user asks. This plan is complete.

## Risks / notes (not action items)

- **WireMock mapping precedence**: exact `"url"` matches outrank the `"urlPattern"` fallback, so the 17 explicitly stubbed ids never hit the 404 fallback. If a run unexpectedly 404s, the mapping file name/id or the `CONNECTION_ID` env value was mistyped — check those first.
- **`docker compose ... up -d --build mock-backend`** must run for new mapping files to load (the suite's `beforeAll` does this on every run, so a plain `npm run test:integration` is enough).
- The processor and the combined image `Dockerfile` are untouched; a mapping run still writes `<outputDir>/<connectionId>.csv`, which the processor's existing `run-config` read already expects.
- The internal `/users/:userId/connections` backend route still exists (used by tooling/tests); only the downloader stopped calling it.
- Integration suite runtime is dominated by the image build + 17 container launches; give it several minutes and a generous CI timeout.



