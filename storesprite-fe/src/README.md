# `src/` directory layout

`storesprite-fe/src/` is organized along **two axes that intentionally do not
line up 1:1**. Read both before adding files.

## Axis 1 — `features/`: user-facing UI (grouped by route/page)

Each feature folder is self-contained: its page, subcomponents, feature-local
types, and unit tests live together.

```
features/
  home/            Home page
  profile/         Profile page
  search-sprite/   Search Sprite AI page
  settings/        Settings page
  stocksprite/     Stock Sprite pages (connections / mappings / schedule)
  store-chat/      Store Chat AI page
```

Types used by only **one** feature live inside that feature under `types/`
(e.g. `features/store-chat/types/StoreChat.interface.ts`) — never in `src/types/`.

## Axis 2 — `types/` + `services/`: backend domain (grouped by service)

These mirror the `storesprite-be` domain layout. A **domain** is one backend
service boundary, and one domain can back several screens:

| domain folder | backend service it mirrors |
| :--- | :--- |
| `types/stocksprite/` · `services/stocksprite/` | StockSprite (connections, mappings, schedule) |
| `types/unas/` | Unas (connection test, warehouse lookup) |
| `types/user/` · `services/user/` | User (settings **and** profile share the user service) |

The folder roots hold **cross-cutting** infrastructure used by every domain:

- `types/` root — shared contracts: `HttpClient`, `SocketService`, `Navigation`,
  `Theme`, `Header`, `Auth`, `Container`, `I18n`, `UserMenu`, `TabbedPageLayout`.
- `services/` root — HTTP/Socket transport: `AxiosClient`, `MockHttpClient`,
  `SocketService`.

## Feature → domain mapping

A feature can be backed by more than one domain (and vice versa) — expected.
Use this table to find the types/services behind any screen:

| feature (UI axis) | backing types/services (domain axis) |
| :--- | :--- |
| `features/stocksprite/` | `types/stocksprite/`, `services/stocksprite/`; `types/unas/` (`IWarehouse`) |
| `features/settings/` | `types/user/` (`Setting`, `SettingService`), `services/user/`; `types/unas/` (connection test) |
| `features/profile/` | `types/user/` (`Profile` — via `config/profileFields.ts`) |
| `features/store-chat/` | feature-local `features/store-chat/types/` |
| `features/search-sprite/` · `features/home/` | self-contained (no shared types) |

## Where does a file go?

Decide by **"who uses this?"** — not by the file's name or the backend it talks to.

| Bucket | Rule | Example |
| :--- | :--- | :--- |
| **Feature-local** | used by *one* feature → next to it under `features/<feature>/` | `features/store-chat/types/StoreChat.interface.ts` |
| **Domain** | used by *several* features that share one backend service → `types/<domain>/` · `services/<domain>/` | `services/user/SettingService.ts` (backs both Settings and Profile) |
| **Shared root** | cross-cutting, no domain affinity → `types/` · `services/` root | `types/Navigation.interface.ts`, `services/AxiosClient.ts` |

Worked example — **StoreChat**: it's used by one feature only, so it moved out of
`types/` into `features/store-chat/types/`. **SettingService** is used by two
features, so it stays in `types/user/` + `services/user/` (the `user` domain is
exactly this case: one service, two screens).

## Conventions

- **Tests** — unit tests colocate with their source; integration tests go in
  `src/test/integration/`; shared test infra lives in `src/test/`.
- **Imports** — direct relative paths, no barrel files.
- **Naming** — interfaces `*.interface.ts` prefixed `I`; utilities kebab-case
  `-util.ts`; components PascalCase `.tsx`.
