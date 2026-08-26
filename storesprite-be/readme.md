# storesprite-be (Backend Control Plane Service)

The Fastify backend control plane for StoreSprite built with **Node.js**, **Fastify**, **TypeScript**, **InversifyJS**, **Socket.IO**, and **@clerk/backend**.

---

## 1. Developer Execution Commands

After launching the Docker container stack via `docker compose up -d`, enter the container terminal or DevContainer session and execute:

* **Start Development Server** (Live TS Hot-Reloading via `tsx`):
  ```bash
  npm run start:dev
  ```
  *Binds to `http://0.0.0.0:3000` so Fastify is accessible from your host browser at `http://localhost:3000/`.*

* **Run Pure Unit Tests** (Fast, all dependencies mocked, 0 database writes):
  ```bash
  npm test
  ```
  *Runs isolated unit tests using `vitest.config.ts` without touching the database.*

* **Run ESLint Type-Aware Strict Check**:
  ```bash
  npm run lint
  ```
  *Runs ESLint with strict TypeScript type-checking (`eslint.config.js`).*

* **Run Integration Tests** (Real PostgreSQL test database):
  ```bash
  npm run test:integration
  ```
  *Runs integration tests against the isolated `storesprite_test_db` database using `vitest.integration.config.ts`, automatically wiping/truncating test tables before each test.*

* **Build Production Dist Output**:
  ```bash
  npm run build
  ```
  *Compiles TypeScript (`tsc`) into pure JavaScript files inside the `dist/` directory.*

* **Run Compiled Release Application**:
  ```bash
  npm run rel
  ```
  *Runs the compiled production application directly from JavaScript output (`node dist/server.js`).*

---

## 2. Database Migrations (MikroORM)

`storesprite-be` uses **MikroORM** for entity modeling and schema migrations against PostgreSQL.

### Running Migrations (Applying to Database)

To apply all pending migrations to the PostgreSQL database:

* **From inside the container / DevContainer**:
  ```bash
  npm run migration:up
  ```
* **From host machine via Docker Compose**:
  ```bash
  docker exec -w /workspace storesprite-be npm run migration:up
  ```

---

### Updating the Database when Entities or Migrations Change

When you modify existing entities (e.g. adding new fields to `User.ts` or creating new entity models) or need to update the database schema:

#### 1. Generate a New Migration Automatically (Recommended)
MikroORM can diff your current entity models against the database schema to generate a migration script automatically:
```bash
npm run migration:create
```
*(or create a blank migration via `npx mikro-orm migration:create --blank`)*

This creates a new migration file in `src/migrations/Migration<Timestamp>_<Name>.ts`.

#### 2. Apply the Updated Migration to PostgreSQL
Run the `migration:up` command:
```bash
npm run migration:up
```

#### 3. Inspecting or Reverting Migrations
* **Check migration status & list executed/pending migrations**:
  ```bash
  npm run migration:list
  ```
* **Revert / Roll back the most recent migration**:
  ```bash
  npm run migration:down
  ```

---

## 3. Route Authentication & Verification

Endpoints in `storesprite-be` use Fastify per-route metadata for flexible auth control:

* **Public Endpoints (`config: { auth: false }`)**:
  - `GET /api/hello`
  - `GET /api/client/status`
* **Clerk JWT Protected Endpoints (`config: { auth: true }`)**:
  - `GET /api/client/me` (requires `Authorization: Bearer <CLERK_JWT>`)
* **Internal Worker Endpoints**:
  - `POST /api/worker/*` (requires `x-worker-token` header)

---

## 4. Database Web GUI (pgAdmin)

A containerized instance of **pgAdmin 4** is available for inspecting and managing the PostgreSQL database from your browser.

### Access & Login
* **URL**: [http://localhost:5050](http://localhost:5050)
* **Email**: `admin@storesprite.com` (if prompted)
* **pgAdmin Login Password**: `admin` (if prompted)
* **PostgreSQL Database Password**: `storesprite_secure_pass` (when prompted to connect to **StoreSprite DB**)

### Database Connection (Pre-Configured)
The `StoreSprite DB` connection is pre-configured and automatically loaded upon startup from `.docker/pgadmin/servers.json`.

1. Open [http://localhost:5050](http://localhost:5050) (automatically logs in in desktop mode).
2. In the left navigation tree, expand **Servers** ➔ click on **StoreSprite DB**.
3. When prompted for the database password, enter: **`storesprite_secure_pass`** (check *"Save Password"*).
4. Browse tables under: `Databases` ➔ `storesprite_db` ➔ `Schemas` ➔ `public` ➔ `Tables` (e.g. `users`, `data_connections`, `user_settings`).