# AGENTS.md

Welcome to **StoreSprite**, a multi-tenant monorepo solution designed to automate product stock count updates, price syncs, and product catalog synchronization in an **UNAS webshop** based on external CSV files (e.g., from suppliers like Cromwell or Dunitker).

This document serves as the primary instructions and contextual reference for AI coding agents operating in this repository.

> [!IMPORTANT]
> The root Markdown files (`CONSTITUTION.md`, `ARCHITECTURE.md`, `AGENTS.md`) define cross-cutting monorepo rules, architectural invariants, security boundaries, and code standards that MUST be respected across all sub-packages (`storesprite-fe`, `storesprite-be`, `stocksprite`).

---

## High-Level Architectural Blueprint

StoreSprite operates on a three-tier multi-tenant architecture consisting of a persistent single-page frontend application, a control-plane backend API, and an ephemeral, on-demand worker execution engine.

### System Components & Communication Flow

1. **Frontend Client (`storesprite-fe`)**:
   * Built with React, Vite, TypeScript, Material-UI (MUI v6 + Emotion), `@clerk/clerk-react`, and `@clerk/themes`.
   * Uses **InversifyJS** for dependency injection via custom context bindings (`ContainerProvider.tsx` and `useInjection()` hook).
   * Authenticates users via Clerk session tokens, which are automatically attached to outbound HTTP requests using Axios interceptors (`ApiClient.ts`).
   * Manages UNAS credentials, CSV column mapping rules, and job triggers.
   * Listens for real-time `sync_progress` updates via Socket.IO connections (`SyncSocketService.ts`).

2. **Backend Control Plane (`storesprite-be`)**:
   * Built with Node.js, Fastify, TypeScript, and InversifyJS.
   * Acts as the central orchestrator, database manager (PostgreSQL), and authentication gateway.
   * **Security Boundaries & Endpoints**:
     * `/api/webhooks/clerk`: Verifies raw body Svix cryptographic signatures before syncing user records to PostgreSQL.
     * `/api/client/*`: Protected via `@clerk/fastify` and `getAuth()` for client UI operations.
     * `/api/internal/stocksprite/*`: Protected via a `preHandler` hook enforcing the `x-internal-token` header. Guards the worker↔backend contract: workers fetch the single connection a job targets (`/connections/:connectionId`) and mapping run-configs (`/mappings/:mappingId/run-config`), and report run progress (`/mappings/:mappingId/progress`).
   * **Real-Time Gateway**: Uses Socket.IO to manage isolated tenant broadcast rooms (`tenant_${userId}`).
   * **Worker Orchestrator**: Spawns an ephemeral `stocksprite` container (downloader → processor) per job, injecting `USER_ID`, `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, and `BACKEND_URL`.

3. **On-Demand Worker (`stocksprite`)**:
   * Ephemeral single container (built from `stocksprite/Dockerfile`) running two
     TypeScript CLI stages in sequence: the **`downloader`** then the **`processor`**.
   * **Execution Lifecycle** (booted on-demand by `storesprite-be` with `USER_ID`,
     `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`):
     1. `downloader` (`stocksprite/downloader`): Fetches the run's one connection from
        `storesprite-be` (`GET /api/internal/stocksprite/connections/:connectionId`,
        guarded by `x-internal-token`), refuses an inactive or missing connection, and
        otherwise stream-downloads that feed (HTTP/SFTP, all auth schemes) and converts
        it in-place to standardized `;`-delimited CSV — `csvkit` for CSV
        delimiters/encodings, a streaming SAX parser for XML — under `temp/<connectionId>.csv`.
     2. `processor` (`stocksprite/processor`): One mapping run — fetches + Ajv-validates the
        run config (`GET /mappings/:mappingId/run-config`), stream-joins the supplier CSV with
        the UNAS product DB per `@storesprite/mapping-rules`, batch-sends `setProduct` to the
        tenant's UNAS webshop via `@storesprite/unas-json-client`, reporting progress to
        `POST /mappings/:mappingId/progress`.
     3. Process completes and the container auto-exits (exit code 0 or 1).

---

## 🐳 Dockerized Development & In-Container Execution Mandate

> [!IMPORTANT]
> **ALL Node.js execution, tests, linter runs, builds, package installations, and database migrations MUST run inside the respective Docker containers, NEVER directly on the host machine.**

### Host vs. Container Division of Labor
* **Host Machine**: You edit code files on the host filesystem (e.g. Windows / macOS / Linux). The source folders (`storesprite-fe`, `storesprite-be`, `stocksprite`) are bind-mounted directly into active Docker containers.
* **Docker Container Runtime**: The Node.js runtime, compilers, TypeScript, linters, test runners, and database connections live **exclusively inside Docker containers**. Never run `npm test`, `npm run lint`, or `npm install` on the host OS when verifying code changes.

### Service-to-Container Mapping & Execution Cheat Sheet

| Service Folder | Docker Container Name | In-Container Working Dir | Purpose & Execution Context |
| :--- | :--- | :--- | :--- |
| **`storesprite-fe/`** | `storesprite-fe` | `/workspace` | Frontend React UI & Vite dev server |
| **`storesprite-be/`** | `storesprite-be` | `/workspace/storesprite-be` | Fastify API, MikroORM & PostgreSQL connections |
| **`stocksprite/` (worker: downloader + processor)** | `stocksprite-dev` | `/workspace/stocksprite` | Dev container for the on-demand stock-sync worker (both subprojects, see `docker-compose.yaml` → `stocksprite-dev`) |
| **`stocksprite/downloader/`** | `stocksprite-dev` (or on-demand `storesprite-downloader`) | `/workspace/stocksprite/downloader` | Downloader CLI, SFTP/HTTP fetching & stream converters |
| **`stocksprite/processor/`** | `stocksprite-dev` | `/workspace/stocksprite/processor` | Processor CLI, CSV reverse-join & UNAS batch update |
| **`packages/unas-json-client/`** | `storesprite-be` (or `stocksprite-dev`) | `/workspace/packages/unas-json-client` | UNAS JSON Client SDK builds, tests & validation |
| **Database** | `postgres` | `/` | PostgreSQL 16 server |

### Common Agent Commands (Run Inside Container)

```bash
# ==============================================================================
# FRONTEND SERVICE (storesprite-fe)
# ==============================================================================
# Run Unit & Component Tests
docker exec -it storesprite-fe npm test

# Run ESLint
docker exec -it storesprite-fe npm run lint

# Install New npm Dependencies
docker exec -it storesprite-fe npm install <package-name>

# ==============================================================================
# BACKEND SERVICE (storesprite-be)
# ==============================================================================
# Run Unit Tests (In-Memory Mocks)
docker exec -it storesprite-be npm test

# Run Integration Tests (Against Live Docker PostgreSQL)
docker exec -it storesprite-be npm run test:integration

# Run ESLint
docker exec -it storesprite-be npm run lint

# Run Database Migrations
docker exec -it storesprite-be npm run migration:up

# Install New npm Dependencies
docker exec -it storesprite-be npm install <package-name>

# ==============================================================================
# UNAS JSON CLIENT PACKAGE (packages/unas-json-client)
# ==============================================================================
# Run Unit Tests
docker exec -it storesprite-be npm --prefix /workspace/packages/unas-json-client test

# Run Build & Lint
docker exec -it storesprite-be npm --prefix /workspace/packages/unas-json-client run build
docker exec -it storesprite-be npm --prefix /workspace/packages/unas-json-client run lint

# ==============================================================================
# STOCKSPRITE WORKER (stocksprite/downloader & stocksprite/processor)
# ==============================================================================
# Run Unit Tests
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/downloader test
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/processor test

# Run Build & Lint
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/downloader run build
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/downloader run lint
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/processor run build
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/processor run lint

# Run Downloader Container Integration Tests (builds downloader-runtime + mocks)
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/downloader run test:integration

# Run Processor Integration Tests (real CSV→UNAS XML pipeline vs in-process fake UNAS)
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/processor run test:integration
```

---

## 1. Monorepo Overview & Service Boundaries

StoreSprite is designed as a multi-tenant platform where multiple users can log in, configure their own UNAS webshop API keys, and run on-demand CSV stock synchronization jobs.

> [!NOTE]
> The project is currently in active development. Some services (e.g. `storesprite-be` endpoints, multi-tenant DB integration) are undergoing implementation and refinement.

The monorepo contains three primary services:

*   **`storesprite-fe/` (Frontend Service)**:
    *   React / Vite / TypeScript single-page application using Material-UI (MUI v6 + Emotion) and `@clerk/clerk-react`.
    *   Uses **InversifyJS** to inject singleton API clients and WebSocket managers via custom hooks (`useInjection()`).
    *   Provides user interfaces for login/auth, tenant account management, CSV column mapping configuration, stock sync triggers, and log monitoring.
    *   Communicates exclusively with `storesprite-be` via REST APIs (attaching Clerk Bearer tokens via Axios interceptors) and WebSockets (`Socket.IO` listening for `sync_progress`).
*   **`storesprite-be/` (Backend Service & Control Plane)**:
    *   Fastify / TypeScript backend built with InversifyJS (Dependency Injection) and Socket.IO.
    *   Provides authentication (`@clerk/fastify`), multi-tenant user data access, PostgreSQL database management, and OpenSearch log aggregation.
    *   **Security Routes**:
        *   `/api/webhooks/clerk`: Svix raw buffer signature verification.
        *   `/api/client/*`: Clerk JWT protected routes for user actions.
        *   `/api/internal/stocksprite/*`: Protected via `INTERNAL_TOKEN` `preHandler` hook. Guards the worker↔backend contract: workers fetch the single connection a job targets (`/connections/:connectionId`) and mapping run-configs (`/mappings/:mappingId/run-config`), and report run progress (`/mappings/:mappingId/progress`).
    *   **Orchestrator**: Spawns and manages on-demand `stocksprite` container instances per tenant (injecting `USER_ID`, `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, and `INTERNAL_TOKEN`).
*   **`stocksprite/` (On-Demand Worker: downloader + processor)**:
    *   Two TypeScript CLI subprojects packaged in ONE combined Docker container
        (`stocksprite/Dockerfile`) that runs them in sequence per job.
    *   Runs **on-demand** for a specific user / mapping run:
        1. Booted by `storesprite-be` with `USER_ID`, `CONNECTION_ID`, `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`.
        2. `downloader` fetches the run's one connection by id from `storesprite-be` (`GET .../connections/:connectionId`), refuses an inactive or missing connection, and otherwise stream-downloads that feed (HTTP/SFTP) and converts it to standardized CSV (`temp/<connectionId>.csv`).
        3. `processor` fetches + validates the run config, stream-joins the supplier CSV with the UNAS product DB per mapping rules, and batch-sends `setProduct` updates to the tenant's UNAS webshop, reporting progress to `storesprite-be`.
        4. Container exits (0/1) upon job completion.

---

## 2. Multi-Tenancy & Security Matrix

| Layer | Identification | Authentication Guard | Access Level |
| --- | --- | --- | --- |
| **Frontend User** | `clerk_user_id` | Clerk Session JWT | Client UI, self tenant data, triggers |
| **Worker Container** | `sync_id` / `user_id` | `INTERNAL_TOKEN` | Worker config fetch, progress emission |
| **Clerk Webhooks** | `svix_id` | Svix Signature Verification | User provisioning & billing synchronization |
| **Log Observability** | Tenant metadata tags | Node API Proxy / OpenSearch Multi-Tenancy | Isolated log views per tenant |

---

## 3. General Agent Directives & Behavior Rules

1.  **Strict Monorepo Scoping & Service Isolation**:
    *   Always verify which service directory (`storesprite-be`, `storesprite-fe`, or `stocksprite`) your changes affect.
    *   Do NOT mix dependencies or configuration between services unless updating root monorepo files (`docker-compose.yaml`, root scripts).
2.  **SOLID, DRY, KISS, Repository Pattern & InversifyJS**:
    *   Enforce **SOLID**, **DRY**, and **KISS** principles across all packages.
    *   **No Direct Instantiation**: Never instantiate dependencies directly (`new ServiceClass()`). Always use InversifyJS container bindings (`@inject`, `@injectable`).
    *   **Mandatory Repository Pattern**: All database operations MUST be encapsulated within repository classes using MikroORM. Route handlers and controllers must interact with domain logic via Services, and Services must interact with data via injected Repository interfaces (e.g. `SettingService -> ISettingRepository -> SettingRepository -> PostgreSQL`).
    *   **Migrations Mandate**: When adding or altering database tables/entities, always use MikroORM CLI migration tools (`npm run migration:create` / `npm run migration:up`) and create corresponding entity classes. Never modify schemas manually.
    *   **Clear Registration**: Clearly bind and register every service, repository, and client in the package's Inversify container.
3.  **TypeScript, File Naming & Directory Standards**:
    *   Agents MUST adhere to all coding invariants defined in [`CONSTITUTION.md`](./CONSTITUTION.md):
        *   **Universal Directory Layout**: All 3 services (`storesprite-be`, `storesprite-fe`, `stocksprite`) maintain consistent root source folders (`src/config/`, `src/di/`, `src/utils/`, `src/types/`, `src/services/`, `src/repositories/`).
        *   **File Naming Invariants**:
            *   Interfaces: Dedicated `*.interface.ts` files with prefix `I` (e.g. `IUserService`, `IHttpClient`).
            *   Utilities: kebab-case ending with `-util.ts` (e.g. `date-util.ts`, `error-util.ts`, `mapping-util.ts`).
            *   Configuration: `.config.ts` or descriptive `.ts`/`.tsx`.
            *   React Components & Pages: PascalCase `.tsx` (e.g. `Header.tsx`, `StockSpritePage.tsx`).
            *   Classes: PascalCase for BE/FE classes (`UserService.ts`, `UserRepository.ts`, `AxiosClient.ts`); kebab-case for worker CLI execution modules (`unas-updater.ts`, `queue-publisher.ts`).
            *   Tests: `.test.ts`, `.spec.ts`, or `.test.tsx` colocated with source or in dedicated test directories.
        *   **Self-Descriptive Naming**: File names, function names, class names, and variable names must be descriptive and clearly convey their purpose, scope, and behavior.
        *   **Class Member Ordering**: Public methods and properties MUST be placed at the top; private methods MUST be placed at the bottom of the class below public methods.
        *   **Private Variable Naming**: Private member variables in classes MUST start with an underscore prefix (e.g. `private _foo: string`, `private _logger: Logger`).
        *   **Shallow Nesting**: Write simple, modular, and effective code. Avoid deeply nested loops (`for` in `for` in `for`) and nested `if`/`else` trees. Use early returns and guard clauses.
        *   **Async Control**: Use `async`/`await` and `try`/`catch` exclusively. Avoid `.then()`/`.catch()` promise chains.
        *   **Floating Promises**: Mark non-awaited promises with `void` to pass strict linting.
        *   **Strict Types**: Avoid `any`; use generics, explicit interfaces, or `unknown` with runtime type narrowing.
        *   **Clean Build & Lint**: All code MUST build cleanly with 0 ESLint errors and 0 warnings.
4.  **Mandatory Dual-Tier Testing & Testability Design**:
    *   **Test Mandate**: When adding new code or updating existing logic, ALWAYS create or update unit tests.
    *   **Comprehensive Scenario Coverage Mandate**: Test suites MUST cover all possible execution paths:
        *   **Happy Path Scenarios**: Standard valid inputs, intended business workflows, and successful responses.
        *   **Edge Cases & Boundary Conditions**: Zero/null values, empty collections, minimum/maximum lengths, special characters, and boundary limits.
        *   **Error & Failure Cases**: Unauthorized access, invalid authentication, schema validation failures, database errors, timeouts, and network failure recovery.
    *   **API & Integration Test Mandates**:
        *   Backend (`storesprite-be`): When creating or modifying API endpoints, ALWAYS create/update an integration test in `tests/integration/` testing against the real test database.
        *   Downloader (`stocksprite/downloader`): When modifying downloader container behavior, run container integration tests against mock services via `npm run test:integration`.
        *   Processor (`stocksprite/processor`): When modifying the processor pipeline or its UNAS client usage, run its in-process integration suite via `npm run test:integration` (real pipeline + real `@storesprite/unas-json-client` stack vs an in-process fake UNAS server — no Docker CLI/daemon needed).
    *   **Execution Commands**:
        ```bash
        npm run test             # Runs pure in-memory unit tests across all packages
        npm run test:integration         # Runs backend integration tests against PostgreSQL (storesprite-be)
        npm run test:integration # Runs container integration tests against mock servers (stocksprite/downloader)
        npm run test:integration # Runs in-process CSV→UNAS integration tests (stocksprite/processor)
        ```
    *   **Testing Conventions**:
        *   *Test Frameworks & Mocking*:
            *   `storesprite-fe`, `storesprite-be`, & `stocksprite` (`downloader` & `processor`): Powered by **Vitest 4**. All use `vitest-mock-extended` (`mock<T>()`) for interface/logger mocks and `vi.mock` automocking + `vi.mocked` for module mocks such as `axios` (`import { mock } from "vitest-mock-extended"`). `storesprite-fe` runs on **Vite 8**.
        *   *File Placement & Naming*: Place tests alongside source files using `.test.ts` or `.spec.ts` (e.g. `unas-updater.test.ts`).
        *   *AAA Pattern*: Organize test bodies clearly with **Arrange**, **Act**, and **Assert** comments.
        *   *Isolation*: Support running single test cases using `-t` or `it.only()`.
5.  **Multi-Tenant & Security Rules**:
    *   Tenant data (UNAS API keys, CSV mapping profiles, stock logs) MUST be strictly isolated per user session/tenant context.
    *   `clientApi` routes MUST be protected via Clerk JWT authentication.
    *   `internalApi` routes MUST be protected via `INTERNAL_TOKEN` authorization.
    *   Webhook endpoints (e.g. Clerk webhooks) MUST verify raw payloads using Svix.
6.  **Strict JSON Schema Validation (Ajv)**:
    *   All incoming JSON payloads across API boundaries (client API, worker API, webhooks), parsed JSON strings, or database JSONB objects MUST be validated against statically declared JSON schemas using **Ajv**.
    *   Never accept or persist arbitrary JSON objects without schema validation at the boundary.
7.  **Logging & Observability Rules**:
    *   **Unified Logging Pattern**: Both `storesprite-be` and `stocksprite` MUST use `log4js` configured with structured JSON output (`jsonWithDataFieldLayout`).
    *   **Log Payloads**: Log messages MUST pass structured context objects as the second parameter instead of string concatenation:
        ```typescript
        logger.error("Error updating UNAS product stock", { sku, error: Util.stringifyError(error) });
        logger.warn("File already processed", { file: fileName });
        logger.info("Cache update finished", { added, updated, removed });
        ```
    *   **Mandatory Log Severity Levels**:
        *   `logger.error`: Log all caught exceptions, UNAS API rate-limit exhaustion, database failures, and worker crashes.
        *   `logger.warn`: Log non-fatal anomalies, skipped records, missing non-critical CSV fields, or retry attempts.
        *   `logger.info`: Log key lifecycle events (job triggers, container spawns, queue publishing counts, process completion).
8.  **Domain Conventions & UNAS Integration**:
    *   Respect UNAS API rate limits (maximum 6,000 requests/hour across shared callers like Dunitker & Cromwell). Batch requests whenever possible.
    *   **Stock Sync Rules**:
        *   Multi-warehouse stock mapping: Primary stock (`free_stock_hu` / Dunaharaszti), secondary stocks (`free_stock_cz` / Czech, `free_stock_wdc` / UK).
        *   If UNAS stock tracking is disabled (`Raktárkészlet` field set to `"off"`), automatically enable stock tracking when syncing inventory.
        *   Inactivate webshop products that no longer exist in the supplier CSV feed.
    *   **Content Sync Rules**:
        *   Descriptions and product images are updated **only if missing** (initial sync). Existing detailed descriptions/images on UNAS must not be overwritten during routine stock/price updates.
9.  **Verification Before Completion (Testing & Linting)**:
    *   Run corresponding unit tests and linter in the specific package directory before reporting task completion:
        ```bash
        npm test
        npm run lint
        ```
    *   Never suppress failing tests or lint errors with empty try/catch blocks or unapproved type casts.
10. **Multi-LLM Compatibility Standard & MCP Usage**:
    *   Whenever editing or adding instructions to `AGENTS.md`, `CONSTITUTION.md`, `ARCHITECTURE.md`, or `README.md`, ALWAYS use standardized, vendor-agnostic Markdown formatting.
    *   Do NOT use vendor-specific syntax, proprietary tags, or LLM-exclusive magic tokens.
    *   **MCP Tools & Server Usage Matrix**:
        *   **Clerk Authentication (`clerk-mcp`)**: Use `npx -y mcp-remote https://mcp.clerk.com/mcp` to fetch official SDK snippets (`clerk_sdk_snippet`, `list_clerk_sdk_snippets`).
        *   **Material UI (`mui-mcp`)**: Use `@mui/mcp@latest` to fetch MUI component documentation via `useMuiDocs` and `fetchDocs`.
        *   **PostgreSQL (`postgres-local`)**: Use `@modelcontextprotocol/server-postgres` to inspect multi-tenant database schemas, migrations, and test raw SQL queries against PostgreSQL.
        *   **Documentation Fetcher (`fetch-docs`)**: Use `mcp-server-fetch` to retrieve up-to-date documentation for Fastify, InversifyJS, and Vitest directly from official sites.
11. **Frontend Internationalization (i18n) & Localization Mandate**:
    *   **No Hardcoded Text**: When adding or updating user-facing components, labels, buttons, helpers, error messages, or placeholders in `storesprite-fe`, NEVER hardcode string literals. Always use `useTranslation()` (`t('logical.path.key')`).
    *   **Synchronous Dictionary Updates**: Every logical string key added or modified MUST be registered in both `storesprite-fe/src/locales/en.ts` (English) and `storesprite-fe/src/locales/hu.ts` (Hungarian) with matching schema hierarchies.
    *   **Zero Raw Key Leakage**: Ensure that missing keys never render logical key names (e.g. `stocksprite.connections.form.xxx`) to the user. Always verify with unit tests (`i18n.test.ts` / component tests).

---

## 4. Technology Stack Summary

| Component | Framework / Library | Primary Duties |
| :--- | :--- | :--- |
| **Frontend** (`storesprite-fe`) | React, Vite, TypeScript, Material-UI (MUI v6), `@clerk/clerk-react`, InversifyJS | Web app UI, tenant auth state, CSV mapping UI, on-demand job triggering & live progress monitoring via Socket.IO |
| **Backend** (`storesprite-be`) | Fastify, TypeScript, InversifyJS, Socket.IO, `@clerk/fastify`, PostgreSQL, OpenSearch | Database access, auth validation, multi-tenant configuration, spawning on-demand `stocksprite` workers, Svix webhooks |
| **Worker** (`stocksprite`) | Node.js, TypeScript CLI, Docker; `downloader` + `processor` subprojects | Ephemeral combined container (`downloader` then `processor`): stream-download/convert supplier feeds, mapping-rules join, batched UNAS `setProduct` updates, auto-exit |

---

## 5. Developer & Agent Reference Commands

All test runs, linter checks, database migrations, and package installations should be executed inside the running Docker containers:

```bash
# Monorepo Docker Orchestration (Root)
docker compose up -d --build

# Backend (storesprite-be)
docker exec -it storesprite-be npm test             # In-memory unit tests
docker exec -it storesprite-be npm run test:integration     # Integration tests against live Postgres
docker exec -it storesprite-be npm run lint         # ESLint checks
docker exec -it storesprite-be npm run migration:up # Apply database migrations

# Frontend (storesprite-fe)
docker exec -it storesprite-fe npm test             # Vitest unit & component tests
docker exec -it storesprite-fe npm run lint         # ESLint checks

# Worker Engine (stocksprite: downloader + processor — container is stocksprite-dev)
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/downloader test
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/processor test
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/downloader run build
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/processor run build
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/downloader run lint
docker exec -it stocksprite-dev npm --prefix /workspace/stocksprite/processor run lint
```
