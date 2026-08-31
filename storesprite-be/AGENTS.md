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

### Adding a new domain feature — the insertion pipeline

Add a feature in this fixed order so the DI registry stays in sync. A missed step fails the
build loudly (barrel consumers can't resolve), never silently:

1. **Entity** — `src/entities/<domain>/X.ts` (MikroORM `@Entity`).
2. **Repository** — `src/repositories/<domain>/XRepository.ts`, with its interface + DTOs in
   `src/types/<domain>/XRepository.interface.ts`.
3. **Service** — `src/services/<domain>/XService.ts`, with its interface in
   `src/types/<domain>/XService.interface.ts`. Inject dependencies with `@inject(TYPES.X)` —
   never instantiate.
4. **DI registry** — add the `TYPES.X` symbol **and** re-export the interface/DTO/entity in
   `src/di/types.ts`; bind it in `src/di/container.ts`.
5. **Routes** — add handlers to the domain's route module (e.g. `routes/stocksprite/connectionsApi.ts`)
   or register a new route plugin from `routes/client/index.ts` / `app.ts`.
6. **Tests** — unit tests in `tests/unit/<domain>/`; DB integration tests in
   `tests/integration/<domain>/`.

> **`di/index.ts` is a live registry, not a formality.** Routes, plugins, services and
> repositories all import `TYPES`, interfaces, DTOs and entities from `../../di/index.js`. Any
> type a new consumer needs must be re-exported there or the barrel goes stale (the `utils/`
> barrel is already partial by design — see the util rule below).

### Conventions

- **Utils** — `utils/index.ts` exposes the cross-cutting `Util` namespace (`stringifyError`,
  `decodeJwtPayload`, `deepEqual`) that routes and services log with. Domain-scoped helpers live
  in `utils/<domain>/*-util.ts` and are imported **directly** (e.g. `SchedulerService` imports
  `utils/stocksprite/schedule-util.ts`), never through `Util`. DI services do not belong in
  `utils/` — `utils/JsonSchemaValidator.ts` is a legacy exception (a DI-bound validator with its
  own interface + `TYPES` binding); put new ones in `services/`.
- **Fastify augmentation** — `src/types/fastify.d.ts` is the canonical home for all
  `declare module "fastify"` augmentation (currently `container`, `io`, `orm`, `userClaims`).
  Add new decorations there, not in plugin-local `declare module` blocks — plugins decorate at
  runtime (`fastify.decorate`) only and carry no local type augmentation.
- **`user` ↔ `unas` coupling is intentional** — Unas credentials are stored in the user's
  settings, so `services/unas/UnasService` injects `ISettingService`, and `types/user`
  (`UserSetting`, `SettingRepository`) references `types/unas/UnasConnection`. The two domains
  are coupled by design; keep the coupling at the type/service level, never by reaching into
  another domain's repository.

---

## 2. Tooling & Framework Invariants

* **Framework & Server**: Node.js, Fastify, TypeScript, `@clerk/backend`, Socket.IO, Svix (webhooks).
* **Dependency Injection**: **InversifyJS** container setup (`src/di/container.ts`, `src/di/types.ts`, `src/plugins/inversify.ts`) registering request-scoped services and repositories.
* **Databases & Telemetry**: PostgreSQL (multi-tenant user data, UNAS credentials, mapping rules) and OpenSearch (structured log aggregation).
* **Logging**: `log4js` configured with `jsonWithDataFieldLayout` (structured single-line JSON with context payloads).
* **Test Runner & Mocking**: **Vitest** using Fastify's App Factory pattern (`buildApp()`), in-memory `fastify.inject()`, and `vitest-mock-extended`. Unit and integration suites are split across `tests/unit/` and `tests/integration/` (see §1).

---

## 3. Local Design & Route Constraints

1. **Security & Route Boundary Protection**:
   * `POST /api/webhooks/clerk`: MUST perform raw body buffer Svix cryptographic signature verification before updating PostgreSQL user records.
   * `/api/client/*`: MUST be protected. Routes opt in/out via `config: { auth: true | false }`; the `registerClerkAuth` onRequest hook (`src/plugins/clerkAuth.ts`) verifies the `Authorization: Bearer <JWT>` and JIT-provisions the user.
   * `/api/internal/stocksprite/*`: MUST be protected via a Fastify `preHandler` hook verifying the `x-internal-token` header.
2. **No Direct Instantiation or Raw Queries in Routes**:
   * Fastify route handlers MUST NOT instantiate services directly (`new UserService()`) or execute inline database queries.
   * Routes MUST receive dependencies via the DI container decorated on the Fastify instance: `request.server.container.get<T>(TYPES.X)` (the `fastify.container` decoration from `src/plugins/inversify.ts`).
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
