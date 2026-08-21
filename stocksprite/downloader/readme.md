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

## 2. Environment Variables

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `USER_ID` | The tenant user ID whose connections to process | — | **Yes** |
| `WORKER_TOKEN` | Secret worker authentication token | `mock_worker_token` | No |
| `BACKEND_URL` | Base URL of `storesprite-be` backend API | `http://storesprite-be:3000` | No |
| `OUTPUT_DIR` | Directory where raw, converted CSVs, and logs are saved | `./temp` (or `/app/temp`) | No |
| `LOG_LEVEL` | Logging level (`debug`, `info`, `warn`, `error`) | `info` | No |

---

## 3. Docker Usage

### Build the Docker Image
```bash
cd stocksprite/downloader
docker build -t storesprite-downloader .
```

### Run the Container (Local Dev / Cloud Run Job)
To run the container and attach it to the shared Docker network (`storesprite-shared-net` defined in the root `docker-compose.yaml`), with the host `temp/` folder mapped for inspection:

```bash
docker run --rm \
  --network storesprite-shared-net \
  -e USER_ID="user_2pYj3X..." \
  -e WORKER_TOKEN="mock_worker_token" \
  -e BACKEND_URL="http://storesprite-be:3000" \
  -e OUTPUT_DIR="/app/temp" \
  -v C:\my-git\storesprite\stocksprite\downloader\temp:/app/temp \
  storesprite-downloader
```

---

## 4. Local Development Commands

```bash
cd stocksprite/downloader

# Run downloader script locally
npm run download

# Run unit tests (Vitest)
npm test

# Build TypeScript to dist/
npm run build

# Run ESLint
npm run lint
```
