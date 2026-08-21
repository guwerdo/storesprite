# StoreSprite Downloader Service

The **StoreSprite Downloader Service** is a lightweight, strongly typed TypeScript application and Docker container designed for on-demand batch execution (Google Cloud Run Jobs / local ephemeral containers).

---

## 1. Single Responsibility & Workflow

1. **Fetches Configuration**: Accepts a `USER_ID`, calls `storesprite-be` (`GET /api/worker/users/:userId/connections` with `x-worker-token`), and filters for `isActive: true` connections.
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
   - Writes structured logs to `stdout` and local log file `temp/downloader.log` using `log4js`.

---

## 2. Development via VS Code Devcontainers

A dedicated **`.devcontainer/`** and **`Dockerfile.dev`** setup is provided to develop and debug the application inside a Linux container environment with `csvkit` and dependencies pre-installed.

1. Open VS Code in `stocksprite/` (or open Command Palette: `F1` / `Ctrl+Shift+P`).
2. Select **"Dev Containers: Reopen in Container"**.
3. Once the container is running, open the integrated terminal and start the downloader:
   ```bash
   npm run dev
   ```
4. The devcontainer is pre-configured with the development environment variables:
   - `USER_ID="user_3Hgss1Pn9eF6eXyIf53rKLieGJp"`
   - `WORKER_TOKEN="mock_worker_token"`
   - `BACKEND_URL="http://storesprite-be:3000"`
   - `OUTPUT_DIR="/workspace/stocksprite/downloader/temp"`
   - Network attached to `storesprite-shared-net` to reach `storesprite-be`.

---

## 3. Production Docker Usage

### Build the Production Image
From the `stocksprite/` directory:
```bash
cd stocksprite
docker build -t storesprite-downloader .
```

### Run the Container (Cloud Run Job / Local Container)
To run the container attached to the shared Docker network (`storesprite-shared-net`), with the host `temp/` folder mapped for inspection:

```bash
docker run --rm \
  --network storesprite-shared-net \
  -e USER_ID="user_3Hgss1Pn9eF6eXyIf53rKLieGJp" \
  -e WORKER_TOKEN="mock_worker_token" \
  -e BACKEND_URL="http://storesprite-be:3000" \
  -e OUTPUT_DIR="/app/temp" \
  -v C:\my-git\storesprite\stocksprite\downloader\temp:/app/temp \
  storesprite-downloader
```

---

## 4. Local CLI Commands

```bash
cd stocksprite/downloader

# Run downloader script
npm run dev
# or
npm run download

# Run unit tests (Vitest)
npm test

# Build TypeScript to dist/
npm run build

# Run ESLint
npm run lint
```
