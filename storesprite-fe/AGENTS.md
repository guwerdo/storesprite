# AGENTS.md - storesprite-fe (Frontend Service)

> [!IMPORTANT]
> This service inherits all monorepo rules from the root [`AGENTS.md`](../AGENTS.md), [`CONSTITUTION.md`](../CONSTITUTION.md), and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Codebase Layout & Navigation

`src/` is organized on **two axes that do not line up 1:1** — read
[`src/README.md`](src/README.md) for the full two-axis model, the feature→domain
mapping table, and the "where does a file go?" rule.

In short:

- **`src/features/<feature>/`** — UI, grouped by route/page (`home/`, `settings/`,
  `profile/`, `stocksprite/`, `store-chat/`, `search-sprite/`). Unit tests colocate
  with their source; feature-only types go in `features/<feature>/types/`.
- **`src/types/<domain>/` + `src/services/<domain>/`** — backend-domain code,
  mirroring the BE domains: `stocksprite/`, `unas/`, `user/`. Shared transport
  (`AxiosClient`, `SocketService`) and cross-cutting UI interfaces stay at the
  `services/`/`types/` roots; dev/test doubles live in `services/mocks/`.
- **`src/test/`** — shared test infra (`setup.ts`); **integration tests** go in
  `src/test/integration/`.

**Service ↔ interface naming is 1:1**: each `services/<domain>/XService.ts` implements
`types/<domain>/XService.interface.ts`, is registered under a matching `TYPES` symbol,
and is wired once in `src/di/container.ts`.

---

## 2. Tooling & Framework Invariants

* **Framework & UI Library**: React 18, Vite 8, TypeScript, Material-UI (MUI v6 + Emotion), `@clerk/clerk-react`, `@clerk/themes`.
* **State & Dependency Injection**: **InversifyJS** container setup (`src/di/container.ts`, `src/di/ContainerProvider.tsx`) exposing services via the `useInjection()` hook.
* **HTTP & Sockets**: Axios HTTP wrapper (`src/services/AxiosClient.ts`, base URL from `VITE_API_BASE_URL`, implements `IHttpClient`) and Socket.IO client (`src/services/SocketService.ts`, implements `ISocketService`).
* **Test Runner & Mocking**: **Vitest 4** (jsdom) with `vitest-mock-extended` (`mock<T>()`) for interface mocks and `vi.mock` + `vi.mocked` for module mocks.

---

## 3. Local Design & State Constraints

1. **Strict Inversify Context Ingestion**:
   * NEVER instantiate API or WebSocket services directly in React components using `new AxiosClient()` or `new SocketService()`.
   * Components MUST consume services exclusively via `useInjection<T>(TYPES.ServiceName)`.
2. **UI & Styling Restrictions**:
   * UI components MUST use Material-UI (`@mui/material`) components and Emotion styling. **Tailwind CSS is prohibited**.
   * Use official MUI MCP tools (`useMuiDocs`, `fetchDocs`) to query component signatures and code registries.
3. **No Direct Axios Requests in Components**:
   * React components MUST NOT invoke `axios.get()` or `fetch()` directly. All HTTP communications must route through injected service interfaces (`IHttpClient`, `ISettingService`, `IConnectionService`, `IUnasService`, `IMappingService`).

---

## 4. Local Test & Lint Verification

Before reporting completion on any task in `storesprite-fe`, run local Vitest unit tests and ESLint checks:

```bash
cd storesprite-fe
npm test
npm run lint
```
*(or `npm run test` and `npm run lint`)*
