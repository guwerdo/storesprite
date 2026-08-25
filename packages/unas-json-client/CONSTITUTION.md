# CONSTITUTION.md — @storesprite/unas-json-client

Non-negotiable invariants for this package. It inherits the monorepo [`CONSTITUTION.md`](../CONSTITUTION.md).

1. **ESM-only, `tsc` build** — `"type": "module"`, NodeNext, `.js`-suffixed relative imports; `dist/` is committed.
2. **Inversify + interfaces mandatory** — one interface per seam; constructor injection via `@inject`; no `new` in the core; no hard Redis/log4js dependency (both are consumer choices behind interfaces).
3. **Typed errors** — throw the `UnasError` hierarchy; never `process.exit`; never swallow exceptions silently.
4. **Extensibility** — every UNAS operation MUST be an `IUnasEndpoint` registered in `registerUnasJsonClient`; the add-a-new-endpoint recipe MUST be documented in `README.md` / `AGENTS.md`.
5. **Testing** — comprehensive coverage (happy path + edge cases + error cases); golden XML fixtures committed and asserted; unit + integration tests run offline.
6. **Logging** — extensive internal logging via `ILogger` (error/warn/info), structured context, never log secrets.
