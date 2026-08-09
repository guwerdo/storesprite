# AGENTS.md - storesprite-fe (Frontend Service)

> [!IMPORTANT]
> This service inherits all monorepo rules from the root [`AGENTS.md`](../AGENTS.md), [`CONSTITUTION.md`](../CONSTITUTION.md), and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Tooling & Framework Invariants

* **Framework & UI Library**: React 18, Vite, TypeScript, Material-UI (MUI v6 + Emotion), `@clerk/clerk-react`, `@clerk/themes`.
* **State & Dependency Injection**: **InversifyJS** container setup (`src/di/container.ts`, `src/di/ContainerProvider.tsx`) exposing services via the `useInjection()` hook.
* **HTTP & Sockets**: Axios API client wrapper (`ApiClient.ts` injecting Clerk Bearer JWT tokens) and Socket.IO real-time sync manager (`SyncSocketService.ts`).
* **Test Runner & Mocking**: **Vitest** with `vitest-mock-extended` (or `vi.fn()`) for interface mocks.

---

## 2. Local Design & State Constraints

1. **Strict Inversify Context Ingestion**:
   * NEVER instantiate API or WebSocket services directly in React components using `new ApiClient()` or `new SyncSocketService()`.
   * Components MUST consume services exclusively via `useInjection<T>(TYPES.ServiceName)`.
2. **UI & Styling Restrictions**:
   * UI components MUST use Material-UI (`@mui/material`) components and Emotion styling. **Tailwind CSS is prohibited**.
   * Use official MUI MCP tools (`useMuiDocs`, `fetchDocs`) to query component signatures and code registries.
3. **No Direct Axios Requests in Components**:
   * React components MUST NOT invoke `axios.get()` or `fetch()` directly. All HTTP communications must route through injected service layer interfaces (`IJobService`, `IApiClient`).

---

## 3. Local Test & Lint Verification

Before reporting completion on any task in `storesprite-fe`, run local Vitest unit tests and ESLint checks:

```bash
cd storesprite-fe
npm test
npm run lint
```
*(or `npm run test` and `npm run lint`)*
