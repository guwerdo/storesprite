# Plan: `@storesprite/unas-json-client` — a typed JSON client over the UNAS XML API

## Context

UNAS is a Hungarian webshop platform with an HTTP API that speaks **XML-only** (POST body is XML, responses are XML, auth is a two-step "ApiKey → Bearer token" flow). That XML surface is not usable by modern tooling (MCP servers, JSON-based services) and is awkward to call from any project that isn't already hand-rolling XML.

Today the repo has exactly one UNAS integration: `UnasClient` inside `stocksprite/processor/app/src/unas/`. It works, but it is (a) entangled with the processor's Inversify/Redis/log4js setup, (b) only implements 4 of ~40 endpoints, and (c) hard-`exit(1)`s the process on auth failure — none of which suits reuse.

This change creates a **new standalone library package** `@storesprite/unas-json-client` (`C:\my-git\storesprite\packages\unas-json-client`) that wraps the legacy XML API behind a **clean, typed JSON interface**, so any project can `file:`-depend on it and call typed methods without ever touching XML. It is deliberately structured so new UNAS endpoints (categories, orders, customers…) can be added one at a time with minimal code — the intended long-term use is to slowly grow a full UNAS wrapper.

**Outcome:** a reusable, extensible JSON client with 4 concrete operations + a generic XML translation/auth core, fully DI-driven internally for testability, shipped with tests that run with no network.

## Fixed decisions (agreed with user)

- **Form:** in-process TypeScript **library SDK** — not an HTTP service, not an MCP server (those can be thin adapters on top later).
- **Scope:** the 4 current operations (`login`, `getProductDB`, `setProduct`, `getWarehouse`) + the generic, typed translation core. Extension-friendliness is the top priority.
- **DI — Inversify inside, everywhere:** the SDK is built on Inversify + interfaces for automatic injection, separation of concerns, and easy test/mock (`@injectable()`, `@inject()`, `@multiInject` endpoint registry, one interface per seam). HTTP client, token store, and logger are **behind interfaces** so consumers are *not* forced onto Redis/log4js.
- **Two external facades:** (1) `registerUnasJsonClient(container, config)` for projects that already use Inversify; (2) `createUnasJsonClient(config, overrides?)` for projects that don't — it builds a throwaway container internally, so the caller never imports Inversify.
- **Migration:** **do not touch the processor project.** The SDK is built standalone; migrating the processor to consume it is a separate follow-up.
- **Delivery:** SDK only.

## Package structure

```
packages/unas-json-client/
├── package.json          # @storesprite/unas-json-client, ESM, exports types+import, build=tsc, test=vitest, lint=eslint
├── tsconfig.json         # app-config base + experimentalDecorators/emitDecoratorMetadata + types:["node"]
├── vitest.config.ts      # { test: { globals: true, environment: "node", include: ["src/**/*.test.ts", "test/**/*.test.ts"] } }
├── eslint.config.js      # flat config (mirror processor/app)
├── README.md             # human usage + description + both facades + override guide
├── AGENTS.md             # AI-agent instructions: inherits root rules + package-specific (extension recipe, testing, naming)
├── CONSTITUTION.md       # package invariants: ESM-only, Inversify+interfaces, typed errors (no exit), extensibility, test mandate
├── src/
    ├── index.ts                      # public barrel; `import "reflect-metadata";` at top, then re-exports
    ├── types/
    │   ├── index.ts
    │   ├── binding-keys.ts           # TYPES = { IUnasJsonClient, IUnasHttpClient, ITokenStore, ILogger, IXmlService, IUnasJsonClientConfig, UnasEndpoint } (all Symbol.for)
    │   └── errors.ts                 # UnasError hierarchy (below)
    ├── config/
    │   ├── index.ts
    │   └── unas-json-client-config.interface.ts   # IUnasJsonClientConfig { baseUrl, apiKey }
    ├── core/                          # the seams / extension contract (interfaces only)
    │   ├── index.ts
    │   ├── i-unas-http-client.ts      # IUnasHttpClient.post(url, body?, headers?) -> { status, data }
    │   ├── i-token-store.ts           # ITokenStore { get(key), set(key, value) }
    │   ├── i-logger.ts                # ILogger { info/warn/error/debug(message, meta?) }
    │   ├── i-xml-service.ts           # IXmlService { parse<T>(xml), buildDocument(root) }
    │   └── i-unas-endpoint.ts         # IUnasEndpoint<TReq,TRes>  ← the extension contract
    ├── http/    axios-unas-http-client.ts      # default IUnasHttpClient (axios, validateStatus: ()=>true)
    ├── auth/    in-memory-token-store.ts       # default ITokenStore (Map-backed)
    ├── logging/ console-logger.ts              # default ILogger (console)
    ├── xml/     fast-xml-service.ts            # default IXmlService (fast-xml-parser)
    ├── client/
    │   ├── index.ts
    │   ├── i-unas-json-client.ts      # IUnasJsonClient (the public JSON surface)
    │   └── unas-json-client.ts        # UnasJsonClient (@injectable) — auth retry + generic _call
    ├── endpoints/                      # one folder per endpoint
    │   ├── index.ts
    │   ├── login/            { login.types.ts, login-endpoint.ts }
    │   ├── get-product-db/   { get-product-db.types.ts, get-product-db-endpoint.ts }
    │   ├── get-warehouse/    { get-warehouse.types.ts, get-warehouse-endpoint.ts }
    │   └── set-product/      { set-product.types.ts, set-product-endpoint.ts,
    │                            xml/product-request-xml-builder.ts,
    │                            xml/product-request-xml-elements.interface.ts }
    └── di/
        ├── index.ts
        ├── register-unas-json-client.ts  # registerUnasJsonClient(container, config)
        └── create-unas-json-client.ts    # createUnasJsonClient(config, overrides?) — non-Inversify facade
└── test/                               # not compiled into dist (outside src/)
    ├── fixtures/requests/*.xml         # golden request XML — what the SDK MUST send
    ├── fixtures/responses/*.xml        # golden response XML — what UNAS returns
    ├── helpers/                        # load-fixture.ts · fake-unas-http-client.ts · test-http-server.ts
    ├── integration/unas-json-client.integration.test.ts
    └── e2e/unas-json-client.e2e.test.ts   # gated: skipped unless UNAS_E2E=1
```

Each source file's test lives beside it (`*.test.ts`). All relative imports use explicit `.js` extensions (NodeNext).

## Key public interfaces & types

```ts
// config
interface IUnasJsonClientConfig { baseUrl: string; apiKey: string; }  // e.g. "https://api.unas.eu/shop/"

// infra seams
interface IUnasHttpClient { post(url: string, body: string | undefined, headers?: Record<string,string>): Promise<{ status: number; data: string }>; }
interface ITokenStore { get(key: string): Promise<string | undefined>; set(key: string, value: string): Promise<void>; }
interface ILogger { info(m: string, meta?: unknown): void; warn(m: string, meta?: unknown): void; error(m: string, meta?: unknown): void; debug(m: string, meta?: unknown): void; }
interface IXmlService { parse<T>(xml: string): T; buildDocument(root: unknown): string; }

// THE extension contract
interface IUnasEndpoint<TRequest = unknown, TResponse = unknown> {
  readonly name: string;            // path suffix, e.g. "getProductDB" → `${baseUrl}getProductDB`
  readonly requiresAuth: boolean;   // false only for login
  buildRequest(request: TRequest): string;   // typed JSON → full XML body
  parseResponse(xml: string): TResponse;     // XML response → typed JSON
}

// public client
interface IUnasJsonClient {
  login(): Promise<string>;                                   // returns Bearer token
  getProductDB(request?: IGetProductDBRequest): Promise<string>; // returns CSV download URL
  setProduct(request: ISetProductRequest): Promise<ISetProductResponse[]>;
  getWarehouse(): Promise<IWarehouseResponse[]>;
}
```

### Endpoint request/response JSON types (public)

```ts
interface ILoginRequest { apiKey: string; webshopInfo?: boolean; }  // webshopInfo default true
interface ILoginResponse { token: string; }

interface IGetProductDBRequest {
  format?: "csv" | "json" | "xls" | "xml";  // default "csv"
  getParam?: boolean;  getStock?: boolean;  getData?: boolean;  // default true → "1"
}

interface IWarehouseResponse { id: number; name: string; publicName: string; }

interface ISetProductRequest { products: ISetProduct[]; }
interface ISetProduct {
  sku: string;
  action?: "add" | "modify";               // default "modify" (confirmed vocab; NOT "new"/"delete")
  description?: string;                    // → Description.Long (CDATA)
  stocks?: ISetProductStock[];             // → Stocks.{Status:{Active:1}, Stock:[...]}
  images?: ISetProductImages;
  datas?: ISetProductData[];               // → Datas.Data
}
interface ISetProductStock { warehouseId?: number; quantity: number; isActive?: boolean; } // warehouseId 1 → omitted (main warehouse)
interface ISetProductData { id: number; value: string; }
interface ISetProductImages { defaultFilename: string; defaultAlt: string; og: number; version: string; images: ISetProductImage[]; }
interface ISetProductImage { type: "base" | "alt"; id: number; sefUrl: string; filename: string; alt: string; importUrl: string; }
interface ISetProductResponse { id: string; sku: string; action: string; status: "ok" | "error"; }
```

## Extension mechanism (how to add an endpoint later)

Every endpoint is an `@injectable()` class implementing `IUnasEndpoint`, holding **all** XML knowledge. The client is generic and XML-agnostic. Adding e.g. `getProduct`:

1. `endpoints/get-product/get-product.types.ts` — `IGetProductRequest`, `IGetProductResponse`.
2. `endpoints/get-product/get-product-endpoint.ts` — `buildRequest` (JSON→XML via `IXmlService.buildDocument`) and `parseResponse` (XML→JSON, throws `UnasParseError` on bad shape).
3. One typed method on `IUnasJsonClient` + `UnasJsonClient`:
   ```ts
   getProduct(request: IGetProductRequest): Promise<IGetProductResponse> { return this._call("getProduct", request); }
   ```
4. One registration line in `registerUnasJsonClient`:
   ```ts
   container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(GetProductEndpoint).inSingletonScope();
   ```
5. Re-export from `endpoints/index.ts`.

`UnasJsonClient` receives all endpoints via `@multiInject(TYPES.UnasEndpoint)`, indexes them by `name` into a `Map`, and `_call(name, params, opts)` looks one up. So "add an endpoint" = 2 small files + 1 method + 1 binding. Consumers can also register their **own** endpoints against `TYPES.UnasEndpoint`.

## Auth flow (inside `UnasJsonClient`)

Mirrors the existing client but **throws instead of `exit(1)`**:

1. `login()` posts `<Params><ApiKey>…</ApiKey><WebshopInfo>true</WebshopInfo></Params>` to `/login` (no Authorization header), parses `<Login><Token>`, returns token. Only endpoint with `requiresAuth=false`.
2. `withAuthRetry<T>(op)`:
   - read token from `ITokenStore.get("unasToken")`; if absent → `login()` + store.
   - run `op(token)` with header `Authorization: Bearer <token>`.
   - on `UnasHttpError` with `status === 400` (UNAS's "token expired" signal) → re-login, store, retry **once**.
   - if the retry still fails → **throw `UnasAuthError`** (never `process.exit`).

The default HTTP client uses `axios.create({ validateStatus: () => true })` so non-2xx returns as a response (not a thrown AxiosError), making the status check the single source of truth and decoupling retry logic from axios internals.

## Error handling

Typed hierarchy in `types/errors.ts`:

- `UnasError` (base, `name` = class name)
- `UnasConfigError` — missing/invalid baseUrl or apiKey
- `UnasTransportError` — network/timeout (post rejected)
- `UnasHttpError` — non-200; carries `status`, `url`, `method`, `responseBody`, and `unasErrorMessage` (extracted from `<Error>`/`<ErrorMessage>` body when XML)
- `UnasAuthError` — login failed / retry-after-refresh failed
- `UnasParseError` — response XML missing expected node
- `UnasProductError` — (reserved; see design note below)

**Design note — `setProduct` per-product status:** `setProduct` returns the full typed `ISetProductResponse[]` (each item carries `status: "ok" | "error"`) rather than throwing on partial failure. This is the faithful-translation behavior and matches the current processor (which returns the array and lets the caller decide). A 100-product batch with 1 failure must not lose the other 99. `UnasProductError` is reserved for a future opt-in fail-fast mode. (If you'd rather it throw, this is a one-line flip — flag during review.)

## DI wiring — `registerUnasJsonClient` + `createUnasJsonClient`

```ts
export function registerUnasJsonClient(container: Container, config: IUnasJsonClientConfig): Container {
  if (!container.isBound(TYPES.IUnasJsonClientConfig)) container.bind(TYPES.IUnasJsonClientConfig).toConstantValue(config);
  if (!container.isBound(TYPES.IUnasHttpClient)) container.bind(TYPES.IUnasHttpClient).to(AxiosUnasHttpClient).inSingletonScope();
  if (!container.isBound(TYPES.ITokenStore))     container.bind(TYPES.ITokenStore).to(InMemoryTokenStore).inSingletonScope();
  if (!container.isBound(TYPES.ILogger))         container.bind(TYPES.ILogger).to(ConsoleLogger).inSingletonScope();
  if (!container.isBound(TYPES.IXmlService))     container.bind(TYPES.IXmlService).to(FastXmlService).inSingletonScope();

  container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(LoginEndpoint).inSingletonScope();
  container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(GetProductDbEndpoint).inSingletonScope();
  container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(GetWarehouseEndpoint).inSingletonScope();
  container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(SetProductEndpoint).inSingletonScope();

  if (!container.isBound(TYPES.IUnasJsonClient)) container.bind(TYPES.IUnasJsonClient).to(UnasJsonClient).inSingletonScope();
  return container;
}

// non-Inversify facade — the caller never imports `inversify`
export function createUnasJsonClient(
  config: IUnasJsonClientConfig,
  overrides?: Partial<{ httpClient: IUnasHttpClient; tokenStore: ITokenStore; logger: ILogger; xmlService: IXmlService }>
): IUnasJsonClient {
  const container = new Container();
  if (overrides?.httpClient) container.bind(TYPES.IUnasHttpClient).toConstantValue(overrides.httpClient);
  if (overrides?.tokenStore) container.bind(TYPES.ITokenStore).toConstantValue(overrides.tokenStore);
  if (overrides?.logger)     container.bind(TYPES.ILogger).toConstantValue(overrides.logger);
  if (overrides?.xmlService) container.bind(TYPES.IXmlService).toConstantValue(overrides.xmlService);
  registerUnasJsonClient(container, config);
  return container.get<IUnasJsonClient>(TYPES.IUnasJsonClient);
}
```

**Override contract:** bind your override (e.g. a Redis-backed `ITokenStore`, a log4js→`ILogger` adapter) *before* calling `registerUnasJsonClient` — the `isBound` guards make defaults lose to pre-bound overrides. `createUnasJsonClient` passes overrides as pre-bound `toConstantValue` bindings the same way.

## Config files (key points)

- **package.json** — `"name": "@storesprite/unas-json-client"`, `"version": "0.1.0"`, `"type": "module"`, `main`/`types` → `./dist/index.js`/`.d.ts`, `exports` `{ ".": { types, import } }`, `files: ["dist"]`, scripts `build=tsc / lint=eslint ./src / test=vitest run src (unit only) / test:integration="vitest run test/integration" / test:e2e="vitest run test/e2e" (optional, gated)`. `dependencies`: `axios`, `fast-xml-parser`, `inversify`, `reflect-metadata` (regular deps, since the `createUnasJsonClient` facade must work for consumers without Inversify installed). `devDependencies` mirror `app-config` (`@eslint/js`, `@types/node`, `eslint`, `typescript`, `typescript-eslint`, `vitest`).
- **tsconfig.json** — app-config base (ES2022, NodeNext, declaration+map, sourceMap, outDir `dist`, rootDir `src`, strict, esModuleInterop, skipLibCheck) **plus** `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `types: ["node"]`. `exclude` includes `**/*.test.ts`.
- **vitest.config.ts** — `{ test: { globals: true, environment: "node" } }`.
- **eslint.config.js** — flat config mirroring `stocksprite/processor/app/eslint.config.js` (tseslint strict/stylistic/recommendedTypeChecked + `projectService`).

**Inversify version note:** pin the SDK to Inversify `^7.5.4`. `storesprite-be` currently uses Inversify 6 — when it eventually consumes the SDK it should align to v7 (or we accept npm hoisting a second copy). Not blocking; flag in the README.

## Documentation & AI-agent compatibility

The package ships three docs (vendor-agnostic GFM + RFC keywords per the monorepo's Multi-LLM Compatibility Standard):

- **`README.md`** — human-facing: what it is, install/`file:` usage, both facades (`registerUnasJsonClient` / `createUnasJsonClient`), override guide, and the "add an endpoint" recipe.
- **`AGENTS.md`** — AI-agent instructions: states it inherits the root `AGENTS.md`/`CONSTITUTION.md`/`ARCHITECTURE.md`, then the package-specific rules — ESM/NodeNext `.js` imports; Inversify `@injectable`/`@inject`/`@multiInject` + one interface per seam; `_`-prefixed private members, public-methods-on-top ordering; the `IUnasEndpoint` extension contract; and the test commands (`npm test`, `npm run test:integration`, `npm run lint`). Written vendor-agnostically (GFM, MUST/SHOULD/NEVER).
- **`CONSTITUTION.md`** — package invariants: ESM-only `tsc` build; Inversify + interfaces mandatory (no `new` in the core, no Redis/log4js hard coupling); typed `UnasError` hierarchy (never `process.exit`); endpoints MUST implement `IUnasEndpoint` and be registered in `registerUnasJsonClient`; comprehensive test mandate (happy path + edge cases + error cases); golden-XML fixtures committed and asserted.

The docs live at the package root so agents/tools that auto-discover `AGENTS.md`/`CONSTITUTION.md` in the directory tree pick them up automatically; `package.json` carries a clear `description` + `keywords` for registry/tooling discovery.

## Testing strategy (three layers)

Layer→script mapping: `npm test` = unit (Layer 1); `npm run test:integration` = integration (Layer 2); `npm run test:e2e` = e2e (Layer 3, optional).

**Layer 1 — unit (offline, deterministic).** Mock the *seam*, not the transport: bind a `FakeUnasHttpClient implements IUnasHttpClient` (a `Map<url,{status,data}>` responder that records every `post(url, body, headers)`) into a real container built by `registerUnasJsonClient`.

- `fast-xml-service.test.ts` — `buildDocument` emits `<?xml…?>` + `format:false` + `#cdata`; `parse` turns a single `<Product>`/`<Warehouse>` into an array (`isArray`).
- `*-endpoint.test.ts` — `buildRequest(input)` equals the **golden request XML** read from `test/fixtures/requests/*.xml`; `parseResponse` returns typed JSON from the golden response fixture and throws `UnasParseError` on a missing node.
- `product-request-xml-builder.test.ts` — port existing builder tests (stock/data CDATA + throw-on-missing).
- `unas-json-client.test.ts` — happy paths for all 4 ops; **auth retry** (`/login` 200 → `/getProductDB` 400 → re-login → `/getProductDB` 200: login called once, endpoint twice, header updated, token stored); **no `exit(1)`** (second failure rejects with `UnasAuthError`). The recorded `FakeUnasHttpClient` calls assert the exact URL, body, and `Authorization` header.
- `register-unas-json-client.test.ts` — pre-bound override wins; a custom endpoint bound to `TYPES.UnasEndpoint` is picked up by `@multiInject`.
- `create-unas-json-client.test.ts` — the factory returns a working `IUnasJsonClient` without the test ever constructing a `Container`; overrides are honored.

**Layer 2 — integration (offline, real HTTP, in-process `node:http`).** `test/helpers/test-http-server.ts` starts a real `node:http` server on an ephemeral port that (a) serves the golden **response** fixtures by route and (b) records every incoming request's method/URL/headers/body. `test/integration/unas-json-client.integration.test.ts` builds a client (via `createUnasJsonClient` with the **real `AxiosUnasHttpClient`**) pointed at `http://127.0.0.1:<port>/shop/`, calls an operation, and asserts the server actually received the golden **request** XML — proving the full axios path (body bytes, headers, URL) with zero docker/JVM and zero network. Request bodies are compared after collapsing inter-tag whitespace (the SDK emits `format:false` minified XML; goldens may be pretty-printed).

**Layer 3 — e2e (opt-in, real `api.unas.eu`).** `test/e2e/unas-json-client.e2e.test.ts` self-skips unless `UNAS_E2E=1` and `UNAS_BASE_URL`/`UNAS_API_KEY` are set. Run manually via `npm run test:e2e` against a **sandbox/test shop** — never CI, never production data, and mindful of the ~6,000 req/hour quota. This is the final confirmation that UNAS truly accepts the XML, and is how future endpoints' real response schemas get captured.

### Golden XML fixtures (`test/fixtures/`)

Committed `.xml` files (sourced from `processor/containers/wiremock/__files/unas-*.xml` and the Postman collection), split into `requests/` (what the SDK must produce) and `responses/` (what UNAS returns): `login.xml`, `getProductDB.xml`, `setProduct-modify.xml`, `setProduct-add.xml`; `login-response.xml`, `getProductDB-response.xml`, `getWarehouse-response.xml`, `setProduct-response-ok.xml`, `setProduct-response-error.xml`. A `test/helpers/load-fixture.ts` helper reads them by name.

## Build order

1. Scaffold package: `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `README.md`, `AGENTS.md`, `CONSTITUTION.md`, empty `src/index.ts`; `npm install`.
2. `types/errors.ts` + `types/binding-keys.ts`.
3. `config/unas-json-client-config.interface.ts`.
4. `core/*` interfaces.
5. Default impls: `http/`, `auth/`, `logging/`, `xml/` (+ tests).
6. Port `set-product/xml/product-request-xml-builder.ts` + `product-request-xml-elements.interface.ts` from the existing `set-product-request-builder.ts` + its `builder/interfaces/*` (+ tests).
7. Endpoints in order login → getProductDB → getWarehouse → setProduct, each with types + endpoint + test.
8. `client/i-unas-json-client.ts` + `client/unas-json-client.ts` (`_call`, `withAuthRetry`, typed methods, error normalization) + tests.
9. `di/register-unas-json-client.ts` + `di/create-unas-json-client.ts` + tests.
10. `src/index.ts` barrel (`import "reflect-metadata";` first) + all sub-barrels.
11. `npm run build`, `npm run lint`, `npm test` — fix until green.

## Verification

- `npm run build` → `dist/` contains `index.js`, `index.d.ts`, maps (commit `dist/`, matching `app-config` — `file:` consumers need it).
- `npm test` → unit tests green (offline, no network).
- `npm run test:integration` → integration tests green (in-process HTTP server + golden-XML request comparison; offline, no JVM/docker).
- `npm run lint` → clean.
- `npm run test:e2e` → optional manual run against a sandbox shop (`UNAS_E2E=1 UNAS_BASE_URL=… UNAS_API_KEY=…`); confirms real UNAS acceptance.
- **Consumer smoke (manual, against wiremock `http://wiremock:8080/shop/`):** in a scratch project add `"@storesprite/unas-json-client": "file:../packages/unas-json-client"`, then:
  ```ts
  // Inversify path
  import { Container } from "inversify";
  import { registerUnasJsonClient, TYPES, type IUnasJsonClient } from "@storesprite/unas-json-client";
  const c = new Container();
  registerUnasJsonClient(c, { baseUrl: "http://wiremock:8080/shop/", apiKey: "test-key" });
  const warehouses = await c.get<IUnasJsonClient>(TYPES.IUnasJsonClient).getWarehouse();

  // non-Inversify path — no `import "inversify"` anywhere
  import { createUnasJsonClient } from "@storesprite/unas-json-client";
  const client = createUnasJsonClient({ baseUrl: "http://wiremock:8080/shop/", apiKey: "test-key" });
  const warehouses2 = await client.getWarehouse();
  ```
  Expect a typed `IWarehouseResponse[]` and a login round-trip through the token store.

## Critical reference files

- `stocksprite/processor/app/src/unas/client/unas-client.ts` — auth/retry/XML-parse logic to generalize (replace `exit(1)` with typed errors).
- `stocksprite/processor/app/src/unas/client/request/builder/set-product-request-builder.ts` + `builder/interfaces/*` — JSON→XML builder to port (CDATA, `format:false`, `<Version>8</Version>`).
- `stocksprite/processor/app/src/unas/client/endpoints.ts` — URL construction + missing-baseUrl error.
- `stocksprite/processor/app/src/inversify.config.ts` — `Symbol.for` keys / `to().inSingletonScope()` pattern `registerUnasJsonClient` mirrors.
- `packages/app-config/package.json` + `tsconfig.json` — package/tsconfig conventions (plus decorator flags).
- `stocksprite/processor/doc/unas-postman-api-requests/Unas.postman_collection.json` — real request XML (incl. `add`/`modify` action) and endpoint list for future endpoints.

## Risks / notes

- **Global `isArray` list** in `FastXmlService` (`Product`, `Warehouse`, later `Order`, `Customer`…) must grow as endpoints are added; a forgotten repeating tag turns a single element into an object. Keep the list in one place.
- **HTTP 400 semantics:** every 400 is treated as "token expired" (one spurious re-login on genuine bad requests). Matches UNAS convention; keep for now, revisit if it becomes noisy.
- **`getProductDB` returns only the CSV URL string**, not parsed CSV — consumers fetch+parse the CSV themselves (CSV parsing is out of SDK scope).
- **Replacing a default endpoint** requires `container.unbind(TYPES.UnasEndpoint)` + rebinding the set (multi-binding nuance); adding endpoints is trivial. Document in README.
- **Inversify version drift** (v6 in `storesprite-be` vs v7 in the processor): the SDK ships Inversify `^7.5.4` as a regular dependency. Consumers on v6 should align to v7 when adopting the SDK to avoid dual copies.
- **`dist/` must be committed** (as `app-config` does); consumers add a `build:deps` step to compile the SDK first.
