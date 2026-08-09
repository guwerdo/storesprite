# Implementation Plan - Modern Responsive UI & Layout

**Specification Reference:** [`UI_SPECIFICATION.md`](file:///C:/my-git/storesprite/storesprite-fe/specs/ui-design/UI_SPECIFICATION.md)  
**Target Package:** `storesprite-fe`  

---

## Proposed Changes & File Manifest

### 1. Theme Configuration (`src/theme/AppThemeProvider.tsx`)
- Implement Deep Slate `#0B0F19` / Indigo `#6366F1` theme tokens.
- Add MUI component style overrides (`MuiButton`, `MuiPaper`, `MuiCard`, `MuiDrawer`, `MuiAppBar`, `MuiListItemButton`, `MuiTooltip`).
- Retain seamless `@clerk/themes` integration for dark/light authentication modal states.

### 2. Extensible Configuration Files (`src/config/`)
- `src/config/navigation.tsx`: Defines `DRAWER_NAV_ITEMS` (`Stock Sprite`, `Store Chat AI`, `Search Sprite AI`). Adding new drawer items is as simple as adding an object with `label`, `path`, `icon`.
- `src/config/userMenu.tsx`: Defines `USER_MENU_ITEMS` (`Profile`, `Settings`, etc.). Adding new user menu items is purely declarative.
- `src/config/profileFields.ts`: Defines configurable user profile attribute lists.

### 3. User Dropdown Menu & Header (`src/components/UserMenu.tsx`, `src/components/Header.tsx`)
- `<UserMenu />`: Dynamically renders items from `USER_MENU_ITEMS`, with user identity header, in-menu Dark Mode switch (`useColorMode()`), and Clerk `signOut()`.
- `<Header />`: Top bar with glassmorphic blur, logo badge, responsive hamburger toggle, and user avatar trigger.

### 4. Collapsible Responsive Layout (`src/components/Layout.tsx`)
- Render drawer items dynamically from `DRAWER_NAV_ITEMS`.
- Support dual drawer modes:
  - Mobile (`< 900px`): Temporary slide-over Drawer with auto-close on selection.
  - Desktop (`>= 900px`): Collapsible Mini-Variant Drawer (`240px` ↔ `68px`) with Tooltips and `localStorage` persistence.
- Active route state synchronized via `useLocation().pathname`.

### 5. Feature Folders & Tabbed Pages (`src/features/`)
Each drawer item and core view has its own dedicated folder matching the UI hierarchy:
- `src/features/stocksprite/`
  - `StockSpritePage.tsx`
  - `tabs/StockSpriteMainTab.tsx` (Tab 1)
  - `tabs/StockSpriteSettingsTab.tsx` (Tab 2)
- `src/features/store-chat/`
  - `StoreChatPage.tsx`
  - `tabs/StoreChatMainTab.tsx` (Tab 1)
  - `tabs/StoreChatSettingsTab.tsx` (Tab 2)
- `src/features/search-sprite/`
  - `SearchSpritePage.tsx`
  - `tabs/SearchSpriteMainTab.tsx` (Tab 1)
  - `tabs/SearchSpriteSettingsTab.tsx` (Tab 2)
- `src/features/settings/`
  - `SettingsPage.tsx` (Global settings placeholder)
- `src/features/profile/`
  - `ProfilePage.tsx` (User account management, standalone logout button removed)

---

## Verification Plan

### Automated Testing
- Run test suite:
  ```bash
  cd storesprite-fe
  npm test
  ```
- Ensure existing Vitest tests pass without regressions.
- Add component unit tests for `UserMenu` and responsive `Layout`.

### Visual & Interactive Check
- Verify drawer collapses to icons on desktop and expands cleanly on toggle.
- Verify temporary drawer opens as overlay on mobile viewport.
- Test user avatar popover menu, dark mode toggle switch, and navigation links.
