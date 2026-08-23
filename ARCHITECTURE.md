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
     * **Worker Endpoints (`/api/worker/*`)**: Guarded by a `preHandler` hook enforcing a shared `Bearer INTERNAL_WORKER_TOKEN`. Allows workers to fetch store credentials and push progress events.
   * **Real-Time Layer**: Direct integration between Fastify's HTTP server and Socket.IO to manage isolated tenant rooms (`tenant_${userId}`).
   * **Testing Advantage**: Built using the App Factory pattern (`buildApp()`), enabling fast, in-memory integration testing using `fastify.inject()` paired with mocked Inversify service bindings.

3. **On-Demand Worker Stack (`stocksprite`)**:
   * **Core Stack**: Node.js + TypeScript CLI + BullMQ + Redis + Docker.
   * **Execution Model**: Fully ephemeral. Triggered on-demand (locally or as an AWS container task) and shuts down immediately upon job completion.
   * **Execution Flow**:
     1. Booted with `USER_ID`, `SYNC_ID`, and `WORKER_TOKEN` environment variables.
     2. `csv-provider`: Downloads the raw supplier inventory feed.
     3. `stocksprite-app`: Requests tenant-specific UNAS API credentials from `storesprite-be` via `POST /api/worker/config`.
     4. BullMQ queues orchestrate inventory mapping, rate limits, and UNAS updates while posting progress events to `POST /api/worker/progress`.
     5. `fluentbit`: Captures application log buffers and streams them directly to the central OpenSearch instance.
     6. Process finishes and container exits (`exit code 0`).

---

## Multi-Tenancy & Security Matrix

| Layer | Identification | Authentication Guard | Access Level |
| --- | --- | --- | --- |
| **Frontend User** | `clerk_user_id` | Clerk Session JWT | Client UI, self tenant data, triggers |
| **Worker Container** | `sync_id` / `user_id` | `INTERNAL_WORKER_TOKEN` | Worker config fetch, progress emission |
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
| DOCKER COMPOSE NETWORK (storesprite-shared-net)                               |
|                                                                               |
|  +------------------------+  +------------------------+  +-----------------+  |
|  |     storesprite-fe     |  |     storesprite-be     |  | stocksprite-app |  |
|  | - React / Vite dev     |  | - Fastify API          |  | - BullMQ Worker |  |
|  | - Port 5173            |  | - Port 3000            |  | - On-demand     |  |
|  +-----------+------------+  +-----------+------------+  +--------+--------+  |
|              |                           |                        |           |
|              +-------------------+-------+                        |           |
|                                  v                                v           |
|                     +-------------------------+      +---------------------+  |
|                     |        postgres         |      |     redis-stack     |  |
|                     | - Port 5432             |      | - Port 6379 / 8001  |  |
|                     +-------------------------+      +---------------------+  |
+-------------------------------------------------------------------------------+
```

