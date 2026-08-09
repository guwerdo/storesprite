# StoreSprite

**StoreSprite** is a multi-tenant monorepo solution designed to automate product stock count updates for **UNAS webshops** based on external CSV files (e.g. from suppliers like Cromwell).

---

## 🏗️ High-Level Architecture Overview

StoreSprite operates on a multi-tenant architecture with three primary services:

1. **Frontend Service (`storesprite-fe`)**: React, Vite, TypeScript & Material-UI (MUI v6) SPA for tenant authentication (`@clerk/clerk-react`), CSV column mapping configuration, shop credential management, and live sync monitoring via Socket.IO.
2. **Backend Control Plane (`storesprite-be`)**: Permanent Node.js + Fastify backend API orchestrator using InversifyJS DI, Socket.IO, PostgreSQL, OpenSearch log aggregation, and Clerk authentication.
3. **On-Demand Worker Engine (`stocksprite`)**: Ephemeral Docker worker container stack (`csv-provider`, `stocksprite-app`, `fluentbit`, BullMQ, Redis) that parses CSV feeds, handles UNAS API rate limits, pushes updates to UNAS, and auto-exits upon job completion.

---

## 📦 Monorepo Structure

* **[`storesprite-fe`](./storesprite-fe)**: Single Page Application for user management, UNAS settings, and stock sync triggers.
* **[`storesprite-be`](./storesprite-be)**: Core API server, database controller, and container launcher.
* **[`stocksprite`](./stocksprite)**: On-demand stock processing and UNAS integration worker.

---

## 🔐 Multi-Tenancy & Security Matrix

| Layer | Identification | Authentication Guard | Access Level |
| --- | --- | --- | --- |
| **Frontend User** | `clerk_user_id` | Clerk Session JWT | Client UI, self tenant data, triggers |
| **Worker Container** | `sync_id` / `user_id` | `INTERNAL_WORKER_TOKEN` | Worker config fetch, progress emission |
| **Clerk Webhooks** | `svix_id` | Svix Signature Verification | User provisioning & billing synchronization |
| **Log Observability** | Tenant metadata tags | Node API Proxy / OpenSearch Multi-Tenancy | Isolated log views per tenant |

---

## 🛠️ Quick Start

### Prerequisites
* **Node.js**: `v18+` or `v20+`
* **Docker & Docker Compose**: For containerized local development

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/guwerdo/storesprite.git
   cd storesprite
   ```

2. **Or launch via Docker Compose**:
   ```bash
   docker compose up --build
   ```

---

## 📑 Governance & Documentation

The root Markdown files (`CONSTITUTION.md`, `ARCHITECTURE.md`, `AGENTS.md`) define cross-cutting monorepo rules, architectural invariants, security boundaries, and guidelines for AI agents and human contributors:

* 🤖 **[`AGENTS.md`](./AGENTS.md)**: Rules, guidelines, security matrix, log standards, and directives for AI coding assistants operating across all monorepo packages.
* 🏛️ **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**: High-level architectural blueprint, component breakdown, data flows, and multi-tenancy design.
* 📜 **[`CONSTITUTION.md`](./CONSTITUTION.md)**: Core architectural invariants, SOLID principles, security boundaries, testing mandates, and code standards.
* 🔌 **[`.agents/mcp_config.json`](./.agents/mcp_config.json)**: Workspace Model Context Protocol (MCP) server configuration for fetching documentation & snippets.