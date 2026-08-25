# @storesprite/unas-json-client

A typed JSON client SDK for the [UNAS](https://unas.hu) webshop XML API. It wraps the legacy XML-over-POST API behind a clean, typed JSON interface, so Node.js applications never touch XML.

- **Typed** — every request and response is a TypeScript interface.
- **Extensible** — add a new UNAS endpoint in a few small steps (see *Adding a new endpoint*).
- **Inversify-first** — built on Inversify + interfaces; every seam (HTTP client, token store, logger, XML service) is injectable and mockable.
- **Two facades** — use it from an Inversify container or a plain function call.

## Install

Consumed via the `file:` protocol (this repo does not publish to a registry):

```json
{
  "dependencies": {
    "@storesprite/unas-json-client": "file:../packages/unas-json-client"
  }
}
```

Build the SDK first (`npm run build` inside `packages/unas-json-client`), then add a `build:deps` step to your consumer (see `storesprite-be` / `stocksprite` for the pattern).

## Quick start

### Non-Inversify

```ts
import { createUnasJsonClient } from "@storesprite/unas-json-client";

const unas = createUnasJsonClient({
  baseUrl: "https://api.unas.eu/shop/",
  apiKey: "your-api-key",
});

const warehouses = await unas.getWarehouse();
```

### Inversify

```ts
import { Container } from "inversify";
import { registerUnasJsonClient, TYPES, type IUnasJsonClient } from "@storesprite/unas-json-client";

const container = new Container();
registerUnasJsonClient(container, { baseUrl: "https://api.unas.eu/shop/", apiKey: "your-api-key" });
const unas = container.get<IUnasJsonClient>(TYPES.IUnasJsonClient);
```

## Operations

| Method | Description |
| --- | --- |
| `login()` | Exchange the API key for a session token (Bearer). |
| `getProductDB(request?)` | Return the URL of the generated product CSV export. |
| `setProduct(request)` | Add/modify products (batched); returns per-product statuses. |
| `getWarehouse()` | List warehouses. |

## Overriding a seam

The SDK ships minimal defaults (in-memory token store, console logger, axios HTTP client, `fast-xml-parser` XML service). Override any of them by implementing its interface and binding it **before** `registerUnasJsonClient`, or passing it to `createUnasJsonClient`:

```ts
import { TYPES, registerUnasJsonClient, type ILogger } from "@storesprite/unas-json-client";

class Log4jsLogger implements ILogger {
  info(message: string, meta?: unknown): void { /* … */ }
  warn(message: string, meta?: unknown): void { /* … */ }
  error(message: string, meta?: unknown): void { /* … */ }
  debug(message: string, meta?: unknown): void { /* … */ }
}

container.bind(TYPES.ILogger).to(Log4jsLogger).inSingletonScope();
registerUnasJsonClient(container, config);
```

## Adding a new endpoint

`getProduct` is the canonical example. The full recipe is in `docs/unas-json-client/plan.md` ("Extension mechanism") and `AGENTS.md`. In short:

1. `src/endpoints/<name>/<name>.types.ts` — request/response interfaces.
2. `src/endpoints/<name>/<name>-endpoint.ts` — an `@injectable()` class implementing `IUnasEndpoint`.
3. One typed method on `IUnasJsonClient` + `UnasJsonClient`.
4. One binding in `registerUnasJsonClient`.
5. Re-export + a test with golden XML.

See `AGENTS.md` and `CONSTITUTION.md` for the full conventions.
