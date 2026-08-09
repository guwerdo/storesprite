# AGENTS.md - stocksprite (On-Demand Worker Engine)

> [!IMPORTANT]
> This service inherits all monorepo rules from the root [`AGENTS.md`](../AGENTS.md), [`CONSTITUTION.md`](../CONSTITUTION.md), and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Tooling & Framework Invariants

* **Worker Stack**: Node.js, TypeScript CLI, BullMQ, Redis (`ioredis`), Docker (`csv-provider`, `stocksprite-app`, `fluentbit`).
* **Dependency Injection**: **InversifyJS** container setup (`src/di/container.ts`, `src/di/types.ts` TYPES symbols).
* **Parser & Connectors**: `fast-xml-parser` for UNAS REST/XML API responses, `csv-parser` for supplier inventory feeds, pluggable `IDataConnector` implementations (`FileDataConnector`, `HttpDataConnector`, `SftpDataConnector`).
* **Logging**: `log4js` configured with `jsonWithDataFieldLayout` (structured JSON logged to stdout and file buffers for FluentBit/OpenSearch).
* **Test Runner & Mocking**: **Jest** (`ts-jest`) with `jest-mock-extended` for interface mocks.

---

## 2. Local Design & Execution Constraints

1. **Ephemeral Lifecycle & Worker Token Isolation**:
   * The container stack is strictly **on-demand**. Processes MUST fetch tenant credentials from `/api/worker/config` using `INTERNAL_WORKER_TOKEN`, push execution progress to `/api/worker/progress`, and cleanly auto-exit (`exit code 0`).
2. **UNAS API & Rate Limiting Rules**:
   * Respect UNAS API rate limits (maximum 6,000 requests/hour). Batch product updates in `SET_PRODUCT` calls.
   * UNAS token expiration must be handled transparently using the `withAuthRetry` pattern.
3. **Product Update Integrity**:
   * **Stock Sync**: Update warehouse inventories (`free_stock_hu`, `free_stock_cz`, `free_stock_wdc`). Automatically set `Raktárkészlet` tracking to active if UNAS returns `"off"`.
   * **Content Sync**: Descriptions and product images MUST only be updated if missing on UNAS (initial sync). Never overwrite existing webshop content during stock runs.
   * **Inactivation**: Mark webshop items as inactive if absent from the supplier CSV feed.

---

## 3. Local Test Execution & Verification

Before reporting completion on any task in `stocksprite`, run local Jest unit tests:

```bash
cd stocksprite/app
npm test
```
*(or `npm run test`)*
