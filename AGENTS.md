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
     * `/api/worker/*`: Protected via a `preHandler` hook enforcing `Bearer INTERNAL_WORKER_TOKEN`. Allows workers to fetch `/api/worker/config` and report `/api/worker/progress`.
   * **Real-Time Gateway**: Uses Socket.IO to manage isolated tenant broadcast rooms (`tenant_${userId}`).
   * **Worker Orchestrator**: Spawns ephemeral `stocksprite` container instances on demand, injecting `USER_ID`, `SYNC_ID`, and `WORKER_TOKEN`.

3. **On-Demand Worker Engine (`stocksprite`)**:
   * Ephemeral Docker stack running Node.js, TypeScript CLI, BullMQ, and Redis.
   * **Execution Lifecycle**:
     1. Booted on-demand with `USER_ID`, `SYNC_ID`, and `WORKER_TOKEN`.
     2. `csv-provider`: Downloads the raw supplier inventory feed.
     3. `stocksprite-app`: Fetches tenant webshop configuration from `/api/worker/config`.
     4. Executes BullMQ queues to handle product matching, UNAS rate limits, and stock/price updates, emitting status to `/api/worker/progress`.
     5. `fluentbit`: Collects log buffers and streams structured JSON logs to OpenSearch.
     6. Process completes and container auto-exits (exit code 0).

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
        *   `/api/worker/*`: Protected via `INTERNAL_WORKER_TOKEN` `preHandler` hook. Allows workers to fetch `/api/worker/config` and report `/api/worker/progress`.
    *   **Orchestrator**: Spawns and manages on-demand `stocksprite` container instances per tenant (injecting `USER_ID`, `SYNC_ID`, and `WORKER_TOKEN`).
*   **`stocksprite/` (On-Demand Stock Sync Worker Engine)**:
    *   Node.js / TypeScript CLI worker stack with BullMQ & Redis, packaged in Docker.
    *   Runs **on-demand** for a specific user/tenant:
        1. Booted with `USER_ID`, `SYNC_ID`, and `WORKER_TOKEN`.
        2. `csv-provider` downloads supplier inventory feed.
        3. `stocksprite-app` requests tenant credentials from `/api/worker/config`.
        4. BullMQ queues map inventory, handle UNAS rate limits, execute updates, and emit progress to `/api/worker/progress`.
        5. `fluentbit` captures application log buffers and streams them to OpenSearch; container exits (0) upon job completion.

---

## 2. Multi-Tenancy & Security Matrix

| Layer | Identification | Authentication Guard | Access Level |
| --- | --- | --- | --- |
| **Frontend User** | `clerk_user_id` | Clerk Session JWT | Client UI, self tenant data, triggers |
| **Worker Container** | `sync_id` / `user_id` | `INTERNAL_WORKER_TOKEN` | Worker config fetch, progress emission |
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
    *   **Testable & Mockable Architecture**: Write modular, loosely coupled code that is easy to test and mock in unit tests.
    *   **API Test Mandate (`npm run test-api`)**: When creating new backend API endpoints or modifying existing route behavior, ALWAYS create or update an API test in `tests/e2e/` testing against the real test database.
    *   **Execution Commands**:
        ```bash
        npm test        # Runs pure in-memory unit tests with mocked dependencies
        npm run test-api # Runs backend E2E API tests against isolated test database
        ```
    *   **Testing Conventions**:
        *   *Test Frameworks & Mocking*:
            *   `storesprite-fe` & `storesprite-be`: Powered by **Vitest**, using `vitest-mock-extended` (or `vi.fn()`) for interface mocks (`import { mock } from "vitest-mock-extended"`).
            *   `stocksprite`: Powered by **Jest**, using `jest-mock-extended` for interface mocks (`import { mock } from "jest-mock-extended"`).
        *   *File Placement & Naming*: Place tests alongside source files using `.test.ts` or `.spec.ts` (e.g. `unas-updater.test.ts`).
        *   *AAA Pattern*: Organize test bodies clearly with **Arrange**, **Act**, and **Assert** comments.
        *   *Isolation*: Support running single test cases using `-t` or `it.only()`.
5.  **Multi-Tenant & Security Rules**:
    *   Tenant data (UNAS API keys, CSV mapping profiles, stock logs) MUST be strictly isolated per user session/tenant context.
    *   `clientApi` routes MUST be protected via Clerk JWT authentication.
    *   `workerApi` routes MUST be protected via `INTERNAL_WORKER_TOKEN` authorization.
    *   Webhook endpoints (e.g. Clerk webhooks) MUST verify raw payloads using Svix.
6.  **Logging & Observability Rules**:
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
7.  **Domain Conventions & UNAS Integration**:
    *   Respect UNAS API rate limits (maximum 6,000 requests/hour across shared callers like Dunitker & Cromwell). Batch requests whenever possible.
    *   **Stock Sync Rules**:
        *   Multi-warehouse stock mapping: Primary stock (`free_stock_hu` / Dunaharaszti), secondary stocks (`free_stock_cz` / Czech, `free_stock_wdc` / UK).
        *   If UNAS stock tracking is disabled (`Raktárkészlet` field set to `"off"`), automatically enable stock tracking when syncing inventory.
        *   Inactivate webshop products that no longer exist in the supplier CSV feed.
    *   **Content Sync Rules**:
        *   Descriptions and product images are updated **only if missing** (initial sync). Existing detailed descriptions/images on UNAS must not be overwritten during routine stock/price updates.
8.  **Verification Before Completion (Testing & Linting)**:
    *   Run corresponding unit tests and linter in the specific package directory before reporting task completion:
        ```bash
        npm test
        npm run lint
        ```
    *   Never suppress failing tests or lint errors with empty try/catch blocks or unapproved type casts.
9.  **Multi-LLM Compatibility Standard & MCP Usage**:
    *   Whenever editing or adding instructions to `AGENTS.md`, `CONSTITUTION.md`, `ARCHITECTURE.md`, or `README.md`, ALWAYS use standardized, vendor-agnostic Markdown formatting.
    *   Do NOT use vendor-specific syntax, proprietary tags, or LLM-exclusive magic tokens.
    *   **MCP Tools & Server Usage Matrix**:
        *   **Clerk Authentication (`clerk-mcp`)**: Use `npx -y mcp-remote https://mcp.clerk.com/mcp` to fetch official SDK snippets (`clerk_sdk_snippet`, `list_clerk_sdk_snippets`).
        *   **Material UI (`mui-mcp`)**: Use `@mui/mcp@latest` to fetch MUI component documentation via `useMuiDocs` and `fetchDocs`.
        *   **PostgreSQL (`postgres-local`)**: Use `@modelcontextprotocol/server-postgres` to inspect multi-tenant database schemas, migrations, and test raw SQL queries against PostgreSQL.
        *   **Documentation Fetcher (`fetch-docs`)**: Use `mcp-server-fetch` to retrieve up-to-date documentation for Fastify, InversifyJS, Vitest, Jest, and BullMQ directly from official sites.

---

## 4. Technology Stack Summary

| Component | Framework / Library | Primary Duties |
| :--- | :--- | :--- |
| **Frontend** (`storesprite-fe`) | React, Vite, TypeScript, Material-UI (MUI v6), `@clerk/clerk-react`, InversifyJS | Web app UI, tenant auth state, CSV mapping UI, on-demand job triggering & live progress monitoring via Socket.IO |
| **Backend** (`storesprite-be`) | Fastify, TypeScript, InversifyJS, Socket.IO, `@clerk/fastify`, PostgreSQL, OpenSearch | Database access, auth validation, multi-tenant configuration, spawning on-demand `stocksprite` workers, Svix webhooks |
| **Worker Engine** (`stocksprite`) | Node.js, TypeScript CLI, BullMQ, Redis, Docker (`csv-provider`, `stocksprite-app`, `fluentbit`) | Ephemeral containerized execution: CSV parsing, BullMQ queue processing, UNAS API updates, OpenSearch log streaming, auto-exit |

---

## 5. Developer & Agent Reference Commands

```bash
# Backend (storesprite-be)
cd storesprite-be
npm install
npm test
npm run dev

# Frontend (storesprite-fe)
cd storesprite-fe
npm install
npm test
npm run dev

# Worker Engine (stocksprite)
cd stocksprite
npm run cache:rel    # Cache webshop snapshot
npm run pub:rel      # Publish datasource items to queue
npm run sub:rel      # Consume queue and sync to UNAS

# Monorepo Docker Orchestration (Root)
docker compose up --build
```
