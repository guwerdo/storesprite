# CONSTITUTION.md

## StoreSprite Monorepo Constitution & Development Invariants

This document outlines the non-negotiable principles, architectural invariants, software design standards, and testing guidelines governing the StoreSprite monorepo.

> [!IMPORTANT]
> The root Markdown files (`CONSTITUTION.md`, `ARCHITECTURE.md`, `AGENTS.md`) define cross-cutting monorepo rules, software design invariants, security boundaries, and testing mandates that MUST be enforced across all sub-packages (`storesprite-fe`, `storesprite-be`, `stocksprite`).

---

### 1. Core Architectural & Software Design Invariants

1. **SOLID, DRY, KISS Development Principles**:
   * **Single Responsibility Principle (SRP)**: Each class/service must have one well-defined responsibility.
   * **Open/Closed Principle (OCP)**: Modules must be open for extension but closed for modification.
   * **Liskov Substitution Principle (LSP)**: Subtypes must be substitutable for their base types/interfaces without altering correctness.
   * **Interface Segregation Principle (ISP)**: Services must depend on narrow, specific interfaces rather than large fat contracts.
   * **Dependency Inversion Principle (DIP)**: High-level modules must depend on abstractions (interfaces), never on concrete low-level implementations.
   * **DRY (Don't Repeat Yourself)**: Eliminate duplicated logic by extracting reusable utilities, models, or service components.
   * **KISS (Keep It Simple, Stupid)**: Favor clear, maintainable, straightforward solutions over premature optimization or unnecessary abstraction layers.

2. **Dependency Injection & InversifyJS Rules**:
   * **No Direct Class Instantiation**: Services and handlers MUST NOT instantiate dependencies directly via `new ServiceClass()`. Always use Dependency Injection.
   * **Explicit Container Registrations**: All services, repositories, and clients must be clearly registered with their corresponding interface symbols (`TYPES.IServiceName`) in the Inversify container.
   * **Interface-Driven Inversion**: All cross-service dependencies must be defined via TypeScript `interface` contracts and injected using **InversifyJS** decorators (`@inject`, `@injectable`).
   * **Monorepo Consistency**: Every service directory (`storesprite-be`, `storesprite-fe`, `stocksprite`) MUST use InversifyJS containers to wire dependencies.

3. **Service Layer Isolation**:
   * `storesprite-fe` is strictly a presentation layer consuming injected API & Socket.IO clients.
   * `storesprite-be` acts as the orchestrator and API gateway with container-registered services.
   * `stocksprite` is an ephemeral worker running containerized BullMQ queues and injected data mappers/clients.

4. **Repository Pattern & Database Access Architecture**:
   * **Mandatory Repository Pattern**: All database interactions across backend services MUST be encapsulated within dedicated repository classes. Handlers, controllers, and domain services must never execute direct SQL queries or invoke raw ORM EntityManager methods directly.
   * **Architectural Benefits**:
     * **Decoupling**: Business logic remains completely agnostic of the database technology, SQL dialect, or ORM quirks.
     * **Effortless Unit Testing**: Domain logic can be tested with fast, in-memory mock repositories (`mock<IRepository>()`) without spinning up databases or Docker containers.
     * **Centralized Data Access**: Queries, caching mechanisms, and data retrieval optimizations live in one dedicated place rather than scattered across route handlers.
     * **Maintainability**: Switching database technologies or caching strategies requires changing only the repository implementation.
   * **Service-to-Repository Layering Standard**:
     * When adding a new table to the database, ALWAYS create:
       1. **Entity Model**: A MikroORM entity class representing rows in the table (e.g. `src/entities/Setting.ts`).
       2. **Repository Interface**: An interface starting with `I` (e.g. `src/types/SettingRepository.interface.ts`).
       3. **Repository Implementation**: An Inversify-injectable class using MikroORM's `EntityManager` (e.g. `src/repositories/SettingRepository.ts`).
       4. **Service Interface & Implementation**: A domain service that encapsulates business logic and interacts exclusively through the repository interface (e.g. `src/services/SettingService.ts`).
     * **Architecture Flow Diagram**:
       ```
       Route Handler -> SettingService -> ISettingRepository -> SettingRepository (MikroORM) -> PostgreSQL (settings table)
       ```
   * **Database Migrations Mandate**:
     * When creating or updating database tables/entities, ALWAYS use MikroORM CLI migration tools (`npm run migration:create` / `npm run migration:up`) to generate and apply deterministic migration scripts. Never modify live database schemas manually.

---

## 2. Testing Mandate & Dual-Tier Strategy

1. **Mandatory Test Coverage**:
   * When adding new code or updating existing logic, ALWAYS create or update unit tests.
   * Unit tests must be fast, in-memory, and use interface mocks (no external services or live database required).
   * Tests must be executable across all sub-packages using the standard command:
     ```bash
     npm test
     ```
     *(or `npm run test`)*

2. **API & End-to-End Test Mandate (`npm run test-api`)**:
   * When creating new API endpoints or modifying existing endpoint behavior in backend services, ALWAYS create or update an API test in `tests/e2e/`.
   * API tests MUST run against the isolated real PostgreSQL test database (`storesprite_test_db`) with automatic table resets/truncations before each test.
   * Run API integration tests via:
     ```bash
     npm run test-api
     ```

3. **Testability & Mockability Design**:
   * Write modular, loosely coupled code that is easy to isolate, test, and mock in unit tests without complex setups.
   * **Framework Breakdown**:
     * `storesprite-fe` & `storesprite-be`: Powered by **Vitest**. Use `vitest-mock-extended` (or `vi.fn()`) for interface mocking.
     * `stocksprite`: Powered by **Jest**. Uses `jest-mock-extended` for interface mocking.
   * **File Organization & Naming**: Test files must reside alongside the source file or within an adjacent test folder using the `.test.ts` or `.spec.ts` suffix (e.g., `unas-updater.ts` -> `unas-updater.test.ts`).
   * **Test Structuring (AAA Pattern)**: Structure every test block explicitly into **Arrange**, **Act**, and **Assert** phases.
   * **Individual Test Execution**: Ensure individual test suites can be isolated using runner flags (`npm test -- -t "test name"` or `it.only(...)`).

---

## 3. Multi-Tenancy & Security Matrix

| Layer | Identification | Authentication Guard | Access Level |
| --- | --- | --- | --- |
| **Frontend User** | `clerk_user_id` | Clerk Session JWT | Client UI, self tenant data, triggers |
| **Worker Container** | `sync_id` / `user_id` | `INTERNAL_WORKER_TOKEN` | Worker config fetch, progress emission |
| **Clerk Webhooks** | `svix_id` | Svix Signature Verification | User provisioning & billing synchronization |
| **Log Observability** | Tenant metadata tags | Node API Proxy / OpenSearch Multi-Tenancy | Isolated log views per tenant |

---

## 4. Code Quality, Directory Layout & TypeScript Standards

1. **Universal Folder Structure Pattern**:
   Across all 3 services (`stocksprite/app/src`, `storesprite-be/src`, `storesprite-fe/src`), source directories MUST follow a shared layout pattern:
   * `src/config/`: Configuration files and environment settings (e.g. `mikro-orm.config.ts`, `log4js.config.ts`, `navigation.tsx`).
   * `src/di/`: InversifyJS container definitions (`container.ts`), symbol registries (`types.ts`), and barrel exports (`index.ts`). In frontend: `ContainerProvider.tsx`.
   * `src/utils/`: Pure utility functions and shared helpers named with the `-util.ts` suffix (e.g. `date-util.ts`, `error-util.ts`), with `index.ts` exporting a unified `Util` namespace.
   * `src/types/`: Interfaces, DTOs, domain models, and shared TypeScript type declarations.
   * `src/services/`: Domain and business logic service classes (`UserService.ts`, `AxiosClient.ts`, etc.).
   * `src/repositories/` (or `src/repository/`): Persistence, Redis, or database abstraction classes isolating data operations.

2. **Universal File Naming Standards**:
   * **Interfaces**: Interface names MUST start with a capital `I` (e.g., `IUserRepository`, `IUserService`, `IHttpClient`) and reside in their own dedicated `*.interface.ts` file (e.g. `UserService.interface.ts` or `unas-updater.interface.ts`). Never define major service/repository interfaces inside implementation files.
   * **Utilities**: Must be in kebab-case ending with `-util.ts` (e.g., `date-util.ts`, `error-util.ts`, `jwt-util.ts`, `mapping-util.ts`).
   * **Configuration**: Must end with `.config.ts` or descriptive `.ts` / `.tsx` (e.g., `mikro-orm.config.ts`, `log4js.config.ts`, `navigation.tsx`).
   * **React Components & Pages**: Must use PascalCase with `.tsx` extension (e.g., `App.tsx`, `Header.tsx`, `StockSpritePage.tsx`, `SearchSpriteMainTab.tsx`).
   * **Classes (BE & FE)**: Must use PascalCase for service and repository classes (e.g., `UserService.ts`, `UserRepository.ts`, `AxiosClient.ts`).
   * **Classes (CLI Worker / stocksprite)**: Follow kebab-case for execution worker modules (e.g., `unas-updater.ts`, `queue-publisher.ts`, `http-client.ts`).
   * **Tests**: Test files MUST be colocated with source files or within a dedicated test directory using `.test.ts`, `.spec.ts`, or `.test.tsx` (e.g., `unas-updater.test.ts`, `UserService.test.ts`, `App.test.tsx`).

3. **Self-Descriptive Naming Conventions**:
   * File names, function names, class names, and variable names must be descriptive and clearly convey their purpose, behavior, and scope.
   * Avoid cryptic abbreviations, single-letter variables (except standard loop indices), or misleading names.

4. **Code Structure, Class Member Ordering & Member Naming**:
   * Code must be clean, simple, and well-structured.
   * **Class Member Ordering**: Public methods and properties MUST be placed at the top of the class definition; all private methods MUST be placed at the bottom of the class file below public methods.
   * **Private Member Variable Naming**: Private member variables in classes MUST start with an underscore prefix (e.g., `private _foo: string`, `private _logger: ILogger`, `private _em: EntityManager`).
   * Avoid deep nesting: use guard clauses, early returns, helper methods, or modular pipelines instead of deeply nested loops (`for` inside `for` inside `for`) or deeply nested `if`/`else` branches.

5. **Asynchronous Code & Promise Control**:
   * Always use `async`/`await` and structured `try`/`catch` blocks for asynchronous code execution.
   * Promise chains using `.then()`, `.catch()`, and `.finally()` are strictly PROHIBITED except when wrapping third-party legacy APIs that require callbacks.
   * All unhandled floating promises MUST be explicitly marked with the `void` operator (e.g. `void start()`, `void initializeSession()`) to comply with strict ESLint checks.

6. **Clean Build & Zero Linter Violations**:
   * Code MUST always build cleanly (`npm run build`).
   * Zero ESLint errors and zero warnings are permitted (`npm run lint`).

7. **Type Safety & Strictness**:
   * TypeScript `strict` mode is enabled across all sub-packages.
   * `any` types are prohibited. Always use strict types, generics, or `unknown` with runtime type narrowing.
   * Public service methods, repository methods, and exported functions MUST declare explicit return types.

8. **Error Handling & Resiliency**:
   * Silent exception swallowing is strictly prohibited.
   * Unhandled CSV parsing errors or UNAS API rate limits must be logged with detailed context and reported back through job state telemetry (`POST /api/worker/progress`).

---

## 5. Logging & Observability Invariants

1. **Unified Structured Logging Pattern (Log4js / OpenSearch)**:
   * Both `storesprite-be` and `stocksprite` MUST use `log4js` configured with a structured JSON layout (`jsonWithDataFieldLayout` pattern).
   * Log entries must output single-line JSON objects containing:
     * `ts`: ISO-8601 timestamp string (`new Date().toISOString()`).
     * `level`: Log level string (`INFO`, `WARN`, `ERROR`).
     * `category`: Service module or logger name.
     * `msg`: Human-readable log message.
     * `context`: Structured key-value object containing contextual payload details (e.g. `sku`, `userId`, `error`, `url`).

2. **Mandatory Error & Event Logging**:
   * **Errors & Exceptions (`logger.error`)**: All caught exceptions, UNAS API failures, CSV parsing errors, database query failures, and unauthorized request attempts MUST be logged as `ERROR` with serialized error details (`Util.stringifyError(error)` or stack traces).
   * **Warnings (`logger.warn`)**: Non-fatal operational anomalies (e.g., skipped records, rate-limit retries, missing optional CSV fields, or already processed files) MUST be logged as `WARN`.
   * **Critical Milestones (`logger.info`)**: Job start/finish, queue publishing counts, worker spawns, and cache updates MUST be logged as `INFO` with metric summaries.

---

## 6. Multi-LLM Agent Compatibility Standard

1. **Vendor-Agnostic Directive Formatting**:
   * All rules, architectural invariants, and agent instructions in `CONSTITUTION.md`, `AGENTS.md`, `ARCHITECTURE.md`, and `README.md` MUST be written using standard, vendor-agnostic GitHub-Flavored Markdown (GFM).
   * Do NOT use proprietary markup or tool-specific magic syntax.
   * Maintain clear, declarative RFC-style keywords (**MUST**, **SHOULD**, **NEVER**) so directives are cleanly interpreted by any LLM coding assistant (e.g. Antigravity, GitHub Copilot, Claude Code, Cursor, Windsurf, Aider).

