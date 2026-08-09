# UI Design Specification: StoreSprite Frontend

**Document Version:** 1.0.0  
**Status:** Approved Specification  
**Location:** `storesprite-fe/specs/ui-design/UI_SPECIFICATION.md`  

---

## 1. Overview & Objectives

This document establishes the official UI/UX and architectural layout specification for the `storesprite-fe` React single-page application.

The goal is to deliver an executive-grade, mobile-friendly, desktop-optimized SaaS interface that adheres strictly to:
- Material-UI (MUI v6) and Emotion styling guidelines (no Tailwind CSS).
- Modern responsive layout principles (fluid breakpoints, responsive touch targets, collapsible navigation).
- Deep Slate / Indigo aesthetic with seamless Dark/Light mode switching and Clerk authentication integration.
- Monorepo architectural rules and dependency injection patterns (InversifyJS).

---

## 2. Design System & Theme Tokens

### 2.1 Color Palette (Modern Deep Slate & Indigo)

| Token | Light Mode (`#F8FAFC` base) | Dark Mode (`#0B0F19` base) | Usage |
| :--- | :--- | :--- | :--- |
| **`primary.main`** | `#4F46E5` (Indigo 600) | `#6366F1` (Indigo 500) | Primary CTA buttons, active route indicators, key highlights |
| **`primary.light`** | `#EEF2FF` (Indigo 50) | `#1E1B4B` (Indigo 950) | Active menu background, badge backgrounds |
| **`background.default`** | `#F8FAFC` (Slate 50) | `#0B0F19` (Slate 950) | App viewport background |
| **`background.paper`** | `#FFFFFF` | `#131B2E` (Slate 900) | Cards, App Bar, Drawer, Popovers, Modals |
| **`text.primary`** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Headings, primary content labels |
| **`text.secondary`** | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Subtitles, metadata, captions |
| **`divider`** | `rgba(226, 232, 240, 0.8)` | `rgba(51, 65, 85, 0.6)` | Subtle card borders, dividers, drawer borders |

### 2.2 Typography & Component Tokens
- **Font Family**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Border Radii**:
  - Cards & Papers: `12px`
  - Buttons & Badges: `8px`
  - Inputs & Dropdowns: `8px`
  - Floating Popovers & Dialogs: `14px`
- **Elevation & Shadows**:
  - Light mode: Low-opacity multi-layered soft shadows (`0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)`).
  - Dark mode: Border-highlighted depth (`border: 1px solid rgba(255, 255, 255, 0.08)` + subtle shadow).
- **Glassmorphism**:
  - `AppBar` uses `backdropFilter: 'blur(12px)'` with `backgroundColor: rgba(...)` matching the active theme mode.

---

## 3. Responsive Layout Architecture

### 3.1 Breakpoint Strategy
- **Mobile (`xs: < 600px`, `sm: 600px - 899px`)**:
  - Top `AppBar` with brand logo and Hamburger Menu icon.
  - Navigation drawer rendered as a **Temporary Swipeable/Slide-out Drawer** (`Drawer variant="temporary"`).
  - Drawer **automatically closes** upon clicking any navigation link.
  - Main container padding: `px: { xs: 1.5, sm: 2.5 }, py: { xs: 2, sm: 2.5 }`.
- **Desktop (`md: 900px+`, `lg: 1200px+`, `xl: 1536px+`)**:
  - Navigation drawer rendered as a **Collapsible Mini-Variant Drawer** (`variant="permanent"`):
    - **Expanded state**: `240px` width (icons + text labels).
    - **Collapsed state**: `68px` width (icons only, centered with Tooltips).
  - Collapse state persisted in browser `localStorage` (default: expanded).
  - Toggle button embedded smoothly in the Drawer / Header.
  - Main container padding: `px: 4, py: 4` wrapped in `<Container maxWidth="xl">`.

### 3.2 Modular Configuration-Driven Architecture

To ensure StoreSprite is easily extensible for future modules and features, all menu systems and tab structures are decoupled into declarative configuration files:

#### 1. Drawer Navigation Config (`src/config/navigation.tsx`)
```typescript
export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
  dividerAfter?: boolean;
}

export const DRAWER_NAV_ITEMS: NavItemConfig[] = [
  { id: 'stock-sprite', label: 'Stock Sprite', path: '/', icon: <Inventory2OutlinedIcon /> },
  { id: 'store-chat', label: 'Store Chat AI', path: '/chat', icon: <SmartToyOutlinedIcon /> },
  { id: 'search-sprite', label: 'Search Sprite AI', path: '/search', icon: <SavedSearchOutlinedIcon /> },
];
```

#### 2. User Menu Config (`src/config/userMenu.tsx`)
```typescript
export interface UserMenuItemConfig {
  id: string;
  label: string;
  path?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  dividerAfter?: boolean;
  color?: 'inherit' | 'primary' | 'error';
}

export const USER_MENU_ITEMS: UserMenuItemConfig[] = [
  { id: 'profile', label: 'Profile', path: '/profile', icon: <PersonOutlineIcon /> },
  { id: 'settings', label: 'Settings', path: '/settings', icon: <SettingsOutlinedIcon /> },
];
```

#### 3. Reusable Tabbed Page Layout (`src/components/TabbedPageLayout.tsx`)
```typescript
export interface TabItemConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

export interface TabbedPageLayoutProps {
  title: string;
  description?: string;
  tabs: TabItemConfig[];
  initialTab?: number;
}
```

### 3.4 Feature-Based Folder Architecture

To mirror the navigation menu hierarchy and keep code organized, modular, and isolated, all UI code is structured into dedicated feature directories:

```
storesprite-fe/src/
├── config/
│   ├── navigation.tsx           # Extensible drawer menu items
│   ├── userMenu.tsx             # Extensible user avatar dropdown items
│   └── profileFields.ts         # User profile field definitions
├── theme/
│   └── AppThemeProvider.tsx     # Deep Slate/Indigo theme & component tokens
├── components/
│   ├── Header.tsx               # Top navigation bar & avatar trigger
│   ├── UserMenu.tsx             # User avatar popover menu & dark mode switch
│   ├── Layout.tsx               # Collapsible desktop / temporary mobile shell
│   ├── TabbedPageLayout.tsx     # Reusable tabbed page container
│   └── AuthGuard.tsx            # Route authentication protection
├── features/
│   ├── stocksprite/             # "Stock Sprite" Drawer item
│   │   ├── StockSpritePage.tsx  # Main page container wiring tabs
│   │   ├── tabs/
│   │   │   ├── StockSpriteMainTab.tsx      # Tab 1: Stock Sprite content
│   │   │   └── StockSpriteSettingsTab.tsx  # Tab 2: Stock Sprite Settings
│   │   └── components/          # Module-specific widgets
│   ├── store-chat/              # "Store Chat AI" Drawer item
│   │   ├── StoreChatPage.tsx    # Main page container wiring tabs
│   │   ├── tabs/
│   │   │   ├── StoreChatMainTab.tsx        # Tab 1: Store Chat content
│   │   │   └── StoreChatSettingsTab.tsx    # Tab 2: Store Chat Settings
│   │   └── components/          # Module-specific chat widgets
│   ├── search-sprite/           # "Search Sprite AI" Drawer item
│   │   ├── SearchSpritePage.tsx # Main page container wiring tabs
│   │   ├── tabs/
│   │   │   ├── SearchSpriteMainTab.tsx     # Tab 1: Search Sprite content
│   │   │   └── SearchSpriteSettingsTab.tsx # Tab 2: Search Sprite Settings
│   │   └── components/          # Module-specific search widgets
│   ├── settings/                # Global Settings
│   │   └── SettingsPage.tsx
│   └── profile/                 # User Profile
│       └── ProfilePage.tsx
```

---

## 4. Header Bar & User Avatar Dropdown Spec

### 4.1 Header Bar (`src/components/Header.tsx`)
- **Left**:
  - Hamburger toggle button (on mobile: toggles temporary drawer; on desktop: toggles drawer expand/collapse).
  - Logo & Brand Title: StoreSprite icon badge + bold typographic brand label.
- **Right**:
  - User Avatar Button (clickable with hover scale effect, opens `<UserMenu />`).
  *(Note: The standalone theme toggle button is removed from the AppBar to keep the top bar clean; the theme toggle is housed inside the user avatar dropdown menu).*

### 4.2 User Dropdown Menu (`src/components/UserMenu.tsx`)
Triggered upon clicking the user avatar in the top right header:

1. **Header Section**:
   - User Avatar (large), Full Name, Email.
   - Tenant / Role Pill Badge (e.g. `Tenant Admin`).
2. **Action Items**:
   - Dynamically mapped from `USER_MENU_ITEMS` (Profile, Settings, and any future links).
   - 🌙 **Dark Mode**: Switch/Toggle row leveraging `useColorMode().toggleColorMode` and `useColorMode().mode`.
3. **Divider & Logout**:
   - 🚪 **Sign Out**: Red-accented logout action executing Clerk's `signOut()`.

---

## 5. Implementation Step-by-Step Plan

### Phase 1: Design System & Theme Upgrade (`src/theme/AppThemeProvider.tsx`)
- Implement comprehensive MUI v6 theme palette with Slate 950 / Indigo 600 color tokens.
- Add component overrides for `MuiButton`, `MuiPaper`, `MuiCard`, `MuiDrawer`, `MuiAppBar`, `MuiListItemButton`, and `MuiTooltip`.

### Phase 2: Extensible Configs & Common Shell Components (`src/config/`, `src/components/`)
- Create `src/config/navigation.tsx`, `src/config/userMenu.tsx`, and `src/config/profileFields.ts`.
- Build `<Header />`, `<UserMenu />`, `<TabbedPageLayout />`, and refactor `<Layout />`.

### Phase 3: Feature Folders & Tabbed Pages (`src/features/`)
- Implement `src/features/stocksprite/` with its main tab and settings tab.
- Implement `src/features/store-chat/` with its main tab and settings tab.
- Implement `src/features/search-sprite/` with its main tab and settings tab.
- Implement `src/features/settings/SettingsPage.tsx` and `src/features/profile/ProfilePage.tsx`.

### Phase 4: App Routing & DI Integration (`src/App.tsx`)
- Connect all feature routes (`/`, `/chat`, `/search`, `/settings`, `/profile`) to `src/App.tsx`.

### Phase 5: Testing & Verification
- Run Vitest test suite (`npm test`).
- Verify responsive layout, drawer collapsibility, user avatar menu, and tab switching.
