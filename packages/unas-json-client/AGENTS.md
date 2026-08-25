# AGENTS.md — @storesprite/unas-json-client

> [!IMPORTANT]
> This package inherits all monorepo rules from the root [`AGENTS.md`](../AGENTS.md), [`CONSTITUTION.md`](../CONSTITUTION.md), and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## 1. What this package is

A typed JSON client SDK over the UNAS webshop XML API. Consumers call typed JSON methods; the SDK translates JSON ↔ XML internally. The UNAS API is XML-over-POST at `https://api.unas.eu/shop/`.

## 2. Package-specific rules

- **ESM + NodeNext** — `"type": "module"`; every relative import carries an explicit `.js` extension.
- **Inversify + interfaces** — every seam is an interface (a `*.interface.ts` file with an `I`-prefixed type) injected via `@inject` / `@injectable`. No `new` in the core.
- **Endpoints** — each UNAS operation is an `@injectable()` class implementing `IUnasEndpoint` under `src/endpoints/*/`. `buildRequest` produces XML via `IXmlService.buildDocument`; `parseResponse` parses XML and throws `UnasParseError` on a bad shape. Register it in `src/di/register-unas-json-client.ts`.
- **Errors** — throw the typed `UnasError` hierarchy (`src/types/errors.ts`); never `process.exit`.
- **Logging** — log through the injected `ILogger`: `error` for failures, `warn` for retries/anomalies, `info` for lifecycle. Never log the API key or a full token.
- **Naming** — `_`-prefixed private members; public members on top, private at the bottom.

## 3. Adding a new endpoint

1. `src/endpoints/<name>/<name>.types.ts` — request/response interfaces.
2. `src/endpoints/<name>/<name>-endpoint.ts` — an `IUnasEndpoint` class.
3. One method on `IUnasJsonClient` + `UnasJsonClient`.
4. One binding in `registerUnasJsonClient`.
5. Re-export + a test with golden XML fixtures.

## 4. Test & verify

```bash
npm test                 # unit tests (offline)
npm run test:integration # in-process HTTP + golden XML (offline)
npm run lint
npm run build
```
