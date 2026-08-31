# Integration tests

Tests in this folder exercise **composed flows** — multiple real pieces wired together
(route + page + DI container + service + HTTP layer), rather than a single file in isolation.

## Convention

- **Unit / component tests** are **colocated** next to their source file
  (e.g. `src/features/stocksprite/schedule/ScheduleForm.test.tsx`).
- **Integration tests** live here under `src/test/integration/`, grouped by flow
  (e.g. `settingsFlow.test.tsx`, `stockspriteFlow.test.tsx`).
- Shared test infrastructure (Vitest `setup.ts`, mocks, fixtures) lives in `src/test/`.

## Running

Run with the rest of the suite: `docker exec -it storesprite-fe npm test`.

> Note: a true integration tier (e.g. against a live backend) may warrant its own
> `npm run test:integration` script and environment configuration — this folder is
> where those tests will live.
