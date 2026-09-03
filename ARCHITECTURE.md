# StoreSprite Monorepo Architecture

StoreSprite is a **multi-tenant** stock synchronization platform designed to update stock levels, prices, and product catalogs in **UNAS webshops** based on external supplier CSV files.

---

## High-Level Architectural Blueprint

StoreSprite uses a decoupled, multi-tenant architecture divided into three core operational tiers:

1. **Frontend Client (`storesprite-fe`)**:
   * **Core Stack**: React + Vite + TypeScript + Material-UI (MUI v6 + Emotion).
   * **Authentication**: Managed by `@clerk/clerk-react` and `@clerk/themes` using session tokens and pre-built components (`<SignInButton/>`, `<UserButton/>`).
   * **Architecture**: Uses **InversifyJS** to inject singleton API clients and WebSocket managers via custom DI bindings (`ContainerProvider.tsx` and `useInjection()` hook).
   * **Communication**:
     * Outbound HTTP requests automatically attach the Clerk session token via Axios interceptors (`ApiClient.ts`).
     * Connects to `storesprite-be` via **Socket.IO** to listen for live sync progress broadcasts (`sync_progress`).

2. **Backend Control Plane (`storesprite-be`)**:
   * **Core Stack**: Node.js + Fastify + TypeScript + InversifyJS.
   * **Role**: Acts as the central orchestrator, database manager (PostgreSQL), search log aggregator (OpenSearch), real-time socket hub, and authentication gateway.
   * **Security & Routing Boundaries**:
     * **Clerk Webhooks (`/api/webhooks/clerk`)**: Uses raw buffer parsing to verify cryptographic Svix signatures before syncing new user records into PostgreSQL.
     * **Client Endpoints (`/api/client/*`)**: Protected by `@clerk/fastify` and `getAuth()`. Accepts user triggers and webshop configs.
     * **Internal Endpoints (`/api/internal/stocksprite/*`)**: Guarded by a `preHandler` hook enforcing the `x-internal-token` header. Allows workers to fetch store credentials and push progress events.
   * **Real-Time Layer**: Direct integration between Fastify's HTTP server and Socket.IO to manage isolated tenant rooms (`tenant_${userId}`).
   * **Testing Advantage**: Built using the App Factory pattern (`buildApp()`), enabling fast, in-memory integration testing using `fastify.inject()` paired with mocked Inversify service bindings.

3. **On-Demand Worker (`stocksprite`)**:
   * **Core Stack**: Node.js + TypeScript CLI, packaged as ONE combined container (built from `stocksprite/Dockerfile`). During development the two subprojects run inside the `stocksprite-dev` container (see `docker-compose.yaml`).
   * **Execution Model**: Fully ephemeral. Spawned on demand by `storesprite-be` per job with the run's env (`USER_ID` / `MAPPING_ID` + `RUN_ID`, `INTERNAL_TOKEN`, `BACKEND_URL`) and shuts down immediately when the run finishes.
   * **Execution Flow** (two CLI stages run in sequence inside the same container):
     1. **`downloader`** (`stocksprite/downloader`): Fetches the tenant's active supplier connections from `storesprite-be` (`GET /api/internal/stocksprite/users/:userId/connections`, guarded by `x-internal-token`), stream-downloads each feed over HTTP/SFTP (no-auth, Bearer, API-key, Basic, SSH-key, password), and ultra-low-memory converts the raw feeds to standardized `;`-delimited CSV — `csvkit` for CSV delimiters/encodings, a streaming SAX parser for XML — writing `temp/<connectionId>.csv`.
     2. **`processor`** (`stocksprite/processor`): Runs one mapping job. Fetches + Ajv-validates the run config (`GET /api/internal/stocksprite/mappings/:mappingId/run-config`), streams the supplier CSV and the UNAS product database, stream-joins/diffs them per `@storesprite/mapping-rules`, sends batched `setProduct` XML to the tenant's UNAS webshop via `@storesprite/unas-json-client` (respecting rate limits), and reports progress (`POST /api/internal/stocksprite/mappings/:mappingId/progress`).
     3. Container exits with the run's exit code (`0` or `1`).

---

## Multi-Tenancy & Security Matrix

| Layer | Identification | Authentication Guard | Access Level |
| --- | --- | --- | --- |
| **Frontend User** | `clerk_user_id` | Clerk Session JWT | Client UI, self tenant data, triggers |
| **Worker Container** | `sync_id` / `user_id` | `INTERNAL_TOKEN` | Worker config fetch, progress emission |
| **Clerk Webhooks** | `svix_id` | Svix Signature Verification | User provisioning & billing synchronization |
| **Log Observability** | Tenant metadata tags | Node API Proxy / OpenSearch Multi-Tenancy | Isolated log views per tenant |

---

## Local Development & Docker Container Environment

StoreSprite uses a Docker-first local development setup. Source code is edited on the host filesystem and bind-mounted into active containers, while all runtime execution, tests, builds, and linting occur inside the containers.

```
+-------------------------------------------------------------------------------+
| HOST MACHINE (Windows / macOS / Linux Editor)                                 |
| - Edit files in ./storesprite-fe, ./storesprite-be, ./stocksprite             |
+---------------------------------------+---------------------------------------+
                                        |  (Bind Mounts)
                                        v
+-------------------------------------------------------------------------------+
| DOCKER COMPOSE (docker-compose.yaml, network: storesprite-shared-net)         |
|  +----------------------+  +---------------------+  +---------------------+   |
|  |    storesprite-fe    |  |    storesprite-be    |  |   stocksprite-dev   |   |
|  | React / Vite dev     |  | Fastify API          |  | worker dev shell    |   |
|  | Port 5173            |  | Port 3000            |  | (docker exec, no    |   |
|  |                      |  |                      |  |  app started)       |   |
|  +----------+-----------+  +----------+----------+  +----------+----------+   |
|             |                        |                          |              |
|             +------------+-----------+------------+-------------+              |
|                          |                         |                          |
|              +--------------------+      +-----------------+                   |
|              |      postgres      |      |     pgadmin     |                   |
|              | Port 5432          |      | Port 5050       |                   |
|              +--------------------+      +-----------------+                   |
+-------------------------------------------------------------------------------+
  At runtime `storesprite-be` spawns the on-demand worker as an ephemeral
  container built from stocksprite/Dockerfile (runs downloader → processor, then
  exits) — it is NOT a compose service.
```

