# StoreSprite Downloader Service

The **StoreSprite Downloader Service** is a lightweight, strongly typed TypeScript application and Docker container designed for on-demand batch execution (Google Cloud Run Jobs / local ephemeral containers).

---

## 1. Single Responsibility & Workflow

1. **Fetches Configuration**: Accepts a `CONNECTION_ID` (plus `USER_ID` for context/logging), calls `storesprite-be` (`GET /api/internal/stocksprite/connections/:connectionId` with `x-internal-token`), and refuses to run when that connection is inactive or missing.
2. **Streams Multi-Protocol Downloads**:
   - **HTTP**: Low-memory streaming GET/POST downloads with authentication (None, Basic, Bearer, ApiKey) and automatic detection of empty bodies or HTML error/redirect pages.
   - **SFTP**: Streaming downloads from remote SFTP servers with password or private key authentication and file selection strategies (`LATEST_ALPHABETICAL`, `LATEST_MODIFIED`, `EXACT_MATCH`).
3. **Ultra-Low Memory Stream Conversion**:
   - **CSV**: Uses streaming CLI tool `csvformat` (`csvkit`) to convert input delimiters to `;` (semicolon).
   - **XML**: Uses a streaming SAX parser to chunk-parse large (400MB+) XML files into standardized `;`-delimited CSV files without in-memory DOM buffering ($< 25\text{ MB}$ memory footprint).
4. **Deterministic File Naming by Connection ID**:
   - Raw downloads: `temp/${connection.id}.raw.${ext}` (e.g. `temp/345.raw.xml`, `temp/2.raw.csv`).
   - Standardized converted outputs: `temp/${connection.id}.csv` (e.g. `temp/345.csv`, `temp/2.csv`).
5. **Logging**:
   - Writes single-line JSON logs (`{ ts, level, category, msg, context }`, category `downloader`) to `stdout` and local log file `temp/downloader.log` using `log4js` — the same structured layout as the processor, so both ephemeral workers are filterable by component in Cloud Logging.

---

## 2. Development via VS Code Devcontainers

A dedicated **`.devcontainer/`**, **`Dockerfile.dev`**, and a **`stocksprite-dev`**
compose service are provided to develop both worker subprojects (`downloader` +
`processor`) inside a single Linux container with `csvkit`, the Docker CLI/Compose
plugin, and all dependencies pre-installed. Source folders are bind-mounted from the
host; `node_modules`/`dist` live only inside the container.

1. Open VS Code in `stocksprite/` (or open Command Palette: `F1` / `Ctrl+Shift+P`).
2. Select **"Dev Containers: Reopen in Container"** — VS Code attaches to the
   `stocksprite-dev` compose service at `/workspace/stocksprite`.
3. The container stays alive with no app running; open an integrated terminal (or
   `docker exec -it stocksprite-dev ...`) and run commands per subproject, e.g.:
   ```bash
   cd /workspace/stocksprite/downloader && npm run build
   cd /workspace/stocksprite/processor && npm run test
   ```
4. The devcontainer is pre-configured with the development environment variables:
   - `USER_ID="user_3Hgss1Pn9eF6eXyIf53rKLieGJp"`
   - `INTERNAL_TOKEN="mock_internal_token"`
   - `BACKEND_URL="http://storesprite-be:3000"`
   - `OUTPUT_DIR="/workspace/stocksprite/downloader/temp"`
   - `MOCK_HOST="host.docker.internal"` (for the container integration tests)
   - Network attached to `storesprite-shared-net` to reach `storesprite-be`.

---

## 3. Production Docker Usage

### Build the Production Image
From the repository root — `stocksprite/Dockerfile` `COPY`s `packages/` and
`stocksprite/...`, so the build context must be the repo root, not `stocksprite/`:
```bash
docker build -f stocksprite/Dockerfile --target downloader-runtime -t storesprite-downloader .
```
> **Note:** the Dockerfile's default target is the combined worker image (runs the
> downloader **then** the processor). `--target downloader-runtime` builds the
> downloader-only runtime stage — the image the run example below (and the
> downloader integration suite) uses. Omit the flag to build the full downloader→processor image.

### Run the Container (Cloud Run Job / Local Container)
To run the container attached to the shared Docker network (`storesprite-shared-net`), with the host `temp/` folder mapped for inspection:

```bash
docker run --rm \
  --network storesprite-shared-net \
  -e USER_ID="user_3Hgss1Pn9eF6eXyIf53rKLieGJp" \
  -e CONNECTION_ID="345" \
  -e INTERNAL_TOKEN="mock_worker_token" \
  -e BACKEND_URL="http://storesprite-be:3000" \
  -e OUTPUT_DIR="/app/temp" \
  -v C:\my-git\storesprite\stocksprite\downloader\temp:/app/temp \
  storesprite-downloader
```
> **Note:** a downloader container fetches and processes **exactly one** feed per
> run. `CONNECTION_ID` selects which single connection to download; the output
> lands at `<OUTPUT_DIR>/<CONNECTION_ID>.csv`. The mapping layer (the combined
> image, or Cloud Run Jobs) passes `CONNECTION_ID` at dispatch so each container
> handles one mapping.

---

## 4. Dual-Tier Testing Strategy

### Unit Tests (In-Memory Fast Mocks)
Unit tests mock network I/O and verify business logic, conversion, and error handling in isolation:
```bash
cd stocksprite/downloader
npm test
```

### Container Integration Test Suite (`npm run test:integration`)
The integration test suite spins up a real test environment on the host via `downloader/test/integration/docker-compose-test-integration.yaml`:
* **WireMock (`mock-backend`)**: Mocks `storesprite-be` single-connection retrieval (`GET /api/internal/stocksprite/connections/:connectionId`).
* **Mock Datasource Server (`mock-datasource-server`)**: An Alpine-based container hosting real **Nginx HTTP** and **OpenSSH SFTP** servers.
* **Downloader Container (`storesprite-downloader:test-integration`)**: Runs the downloader-only runtime stage (`--target downloader-runtime` of the production multi-stage image) against the test network.

#### Scenarios Covered:
Each scenario runs one downloader container booted with a single `CONNECTION_ID`,
which downloads/converts exactly that one connection to `<OUTPUT_DIR>/<id>.csv`:
1. **Happy Path — 12 Single-Connection Runs (9 Protocols/Auth + 3 Encodings)**:
   - HTTP Public (Comma Delimited CSV)
   - HTTP Pipe Delimited CSV
   - HTTP Semicolon Delimited CSV
   - HTTP Bearer Token Auth CSV
   - HTTP API Key Header (`X-Supplier-API-Key`) CSV
   - HTTP Basic Auth (`.htpasswd`) CSV
   - HTTP XML Product Catalog (`<catalog><product>...`) converted via SAX to standardized CSV
   - SFTP Username & Password Auth CSV
   - SFTP SSH Private Key (`id_rsa` / `id_rsa.pub`) Auth CSV
   - HTTP Windows-1250 (Hungarian) CSV, converted to UTF-8
   - HTTP UTF-8 with BOM CSV, BOM stripped
   - HTTP ISO-8859-2 (Latin-2) CSV, converted to UTF-8
2. **Negative Test: Malformed XML**:
   - Asserts downstream XML parser catches broken XML syntax and exits 1 with an error summary.
3. **Negative Test: Invalid Authentication**:
   - Asserts HTTP 401 Bearer Token and bad SFTP password runs exit 1, logged and isolated per connection.
4. **Negative Test: Connection Not Found (404)**:
   - Asserts downloader exits 1 immediately when the backend returns 404 for the `CONNECTION_ID`.
5. **Negative Test: Inactive Connection**:
   - Asserts downloader refuses to run and exits 1 when the fetched connection has `isActive: false`.

#### Running Integration Tests:
Run the integration test inside the `stocksprite-dev` container (or from your host
machine where Docker is running — it just needs the Docker CLI + a reachable daemon):
```bash
docker exec -it stocksprite-dev sh -c "cd /workspace/stocksprite/downloader && npm run test:integration"
```
The suite needs the Docker CLI/daemon (it builds the `downloader-runtime` target and
starts the mock containers via `docker compose`). The mock services publish their HTTP
ports on the Docker host; when the suite runs from inside a container, `MOCK_HOST`
must point at the host (the `stocksprite-dev` image sets it to `host.docker.internal`;
defaults to `127.0.0.1` when unset, e.g. running directly on the host).

### Processor Integration Test Suite (`npm run test:integration`)

The processor's integration tier is **in-process — it needs no extra Docker**. It runs
inside `stocksprite-dev` like the unit tests and fakes the two remote HTTP dependencies
it has rather than containerizing them
(`processor/test/integration/processor.integration.test.ts`):

* **Real, untouched:** the full processor pipeline — `ProcessorService`,
  `ConnectionFeedService`, `RuleTransformService`, `UnasProductDbService`,
  `UnasUpdateService`, `ConnectionIndexRepository` (in-memory) — plus the real
  `@storesprite/unas-json-client` HTTP stack (`login`, `getProductDB`, `setProduct`).
* **Faked in-process:** the UNAS API is a `node:http` fake on an ephemeral loopback
  port (`fake-unas-server.ts`); the backend client is a `mock<IBackendApiClient>()`
  (no HTTP) that hands the service a run-config pointing the real UNAS client at the
  fake and records the reported progress sequence.
* **Not exercised:** the Inversify composition root / `index.ts` boot — the test
  composes the services manually with a `mock<Logger>()`.

It asserts the golden CSV→XML mapping outcomes (happy path, zeroed stock, partial
update, no-op, skip) plus batching of >100 diffs into ≤100-SKU `setProduct` calls.

#### Running Integration Tests:
```bash
docker exec -it stocksprite-dev sh -c "cd /workspace/stocksprite/processor && npm run test:integration"
```
Only `node` + loopback is required — no Docker CLI or daemon.

---

## 5. Local CLI Commands

```bash
cd stocksprite/downloader

# Run downloader script in dev mode
npm run start:dev
# or
npm run download

# Run fast unit tests (Vitest)
npm test

# Run Docker container integration test suite (WireMock + Real Nginx/SFTP Supplier)
npm run test:integration

# Build TypeScript to dist/
npm run build

# Run ESLint
npm run lint
```
