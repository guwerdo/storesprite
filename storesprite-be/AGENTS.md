# AGENTS.md - storesprite-be (Backend Control Plane Service)

> [!IMPORTANT]
> This service inherits all monorepo rules from the root [`AGENTS.md`](../AGENTS.md), [`CONSTITUTION.md`](../CONSTITUTION.md), and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Tooling & Framework Invariants

* **Framework & Server**: Node.js, Fastify, TypeScript, `@clerk/fastify`, Socket.IO, Svix (webhooks).
* **Dependency Injection**: **InversifyJS** container setup (`src/di/container.ts`, `src/di/types.ts`, `src/plugins/inversify.ts`) registering request-scoped services and repositories.
* **Databases & Telemetry**: PostgreSQL (multi-tenant user data, UNAS credentials, mapping rules) and OpenSearch (structured log aggregation).
* **Logging**: `log4js` configured with `jsonWithDataFieldLayout` (structured single-line JSON with context payloads).
* **Test Runner & Mocking**: **Vitest** using Fastify's App Factory pattern (`buildApp()`), in-memory `fastify.inject()`, and `vitest-mock-extended`.

---

## 2. Local Design & Route Constraints

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

## 3. Local Test & Lint Verification

Before reporting completion on any task in `storesprite-be`, run local Vitest unit tests and ESLint checks:

```bash
cd storesprite-be
npm test
npm run lint
```
*(or `npm run test` and `npm run lint`)*
