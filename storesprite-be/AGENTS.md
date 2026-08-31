# AGENTS.md - storesprite-be (Backend Control Plane Service)

> [!IMPORTANT]
> This service inherits all monorepo rules from the root [`AGENTS.md`](../AGENTS.md), [`CONSTITUTION.md`](../CONSTITUTION.md), and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Codebase Layout & Navigation

`src/` is grouped by **backend domain** — `stocksprite/`, `unas/`, `user/` — down the
vertical slices, with shared infrastructure at the roots:

- **`src/{entities,repositories,services,types}/<domain>/`** — one folder per domain across
  each layer (e.g. `services/stocksprite/`, `repositories/user/`).
- **`src/routes/`** — Fastify route modules, also domain-grouped (`stocksprite/`, `unas/`,
  `user/`, `client/`). `/api/client/*` is Clerk-protected; `/api/internal/stocksprite/*` is
  protected by the `x-internal-token` `preHandler` hook (`stocksprite/internalAuth.ts`).
- **Roots (cross-domain infrastructure):** `app.ts` (the `buildApp()` app-factory — the single
  seam every test uses), `server.ts` (boot), `di/` (Inversify container + `TYPES`), `plugins/`,
  `config/` (app/logger/ORM config), `utils/`, `log/`, `migrations/`, `schemas/`.

**Tests** live in a dedicated `tests/` tree, cleanly separated by category:

- `tests/unit/` — fast, dependencies mocked, **0 DB writes**. Run via `npm test`
  (`vitest.config.ts`, includes `tests/unit/**`).
- `tests/integration/` — real `storesprite_test_db`, truncated per test, runs serially. Run via
  `npm run test:integration` (`vitest.integration.config.ts`, includes `tests/integration/**`).
- `tests/unit/helpers/unasFixtures.ts` — shared Unas mock fixtures (used by unit tests and,
  across the boundary, by `tests/integration/unas/unasLoginApi.test.ts`).
- `tests/integration/helpers/testDatabase.ts` — the test-DB reset used by every integration test.

> **FE↔BE test-convention difference:** the FE colocates unit tests next to source (`*.test.ts`
> beside the file); the BE keeps a dedicated `tests/` tree by design — BE unit tests still
> exercise `buildApp()` + `fastify.inject()` with mocked DI, so they need the app seam, not
> proximity to the file under test.

---

## 2. Tooling & Framework Invariants

* **Framework & Server**: Node.js, Fastify, TypeScript, `@clerk/fastify`, Socket.IO, Svix (webhooks).
* **Dependency Injection**: **InversifyJS** container setup (`src/di/container.ts`, `src/di/types.ts`, `src/plugins/inversify.ts`) registering request-scoped services and repositories.
* **Databases & Telemetry**: PostgreSQL (multi-tenant user data, UNAS credentials, mapping rules) and OpenSearch (structured log aggregation).
* **Logging**: `log4js` configured with `jsonWithDataFieldLayout` (structured single-line JSON with context payloads).
* **Test Runner & Mocking**: **Vitest** using Fastify's App Factory pattern (`buildApp()`), in-memory `fastify.inject()`, and `vitest-mock-extended`. Unit and integration suites are split across `tests/unit/` and `tests/integration/` (see §1).

---

## 3. Local Design & Route Constraints

1. **Security & Route Boundary Protection**:
   * `/api/webhooks/clerk`: MUST perform raw body buffer Svix cryptographic signature verification before updating PostgreSQL user records.
   * `/api/client/*`: MUST be protected via `@clerk/fastify` and `getAuth()` middleware.
   * `/api/internal/stocksprite/*`: MUST be protected via a Fastify `preHandler` hook verifying the `x-internal-token` header.
2. **No Direct Instantiation or Raw Queries in Routes**:
   * Fastify route handlers MUST NOT instantiate services directly (`new UserService()`) or execute inline database queries.
   * Routes MUST receive dependencies via the Fastify Inversify DI decorator (`fastify.diContainer`).
3. **Structured Log Payload Requirement**:
   * Never concatenate exception strings. Always log using `logger.error("Message", { contextKey: value, error: Util.stringifyError(error) })`.

---

## 4. Local Test & Lint Verification

Before reporting completion on any task in `storesprite-be`, run local Vitest unit tests and ESLint checks:

```bash
cd storesprite-be
npm test
npm run lint
```
*(or `npm run test` and `npm run lint`)*
