# UI Context
<!-- WHEN TO LOAD: Building pages, components, layouts. Changing admin or user dashboard. Styling, theming, responsive work. -->

## Stack

- **Framework:** Next.js 16 App Router (React 18)
- **Styling:** Tailwind 3 + `tailwindcss-animate` + CSS variables for theming
- **UI primitives:** Radix UI (dialog, dropdown, tabs, select, toast, switch, checkbox, tooltip, popover, scroll-area, etc.)
- **Icons:** `lucide-react`
- **Charts:** `recharts`
- **Forms:** `react-hook-form` + `@hookform/resolvers` + `zod`
- **Data fetching:** `@tanstack/react-query` v5
- **State:** `zustand` (auth store only)
- **Toasts:** `sonner` (richColors, top-right)
- **Drag & drop:** `@dnd-kit` (categories/services ordering)
- **Date:** `date-fns` + `react-day-picker`

## Fonts

- **Inter** — body text (`font-inter`, `var(--font-inter)`)
- **Manrope** — headlines/labels (`font-headline`, `font-label`, `var(--font-manrope)`)

Loaded in `src/app/layout.tsx` via `next/font/google`.

## Color System (tailwind.config.ts)

Material 3-inspired. Primary: `#2D5A4C` (teal-green). Uses HSL CSS variables for shadcn-compatible tokens.

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#2D5A4C` | Buttons, active states |
| `primary-dim` | `#1E3D33` | Hover states |
| `surface` | `#F9F9F8` | Page backgrounds |
| `surface-container` | `#EDEEED` | Card/panel backgrounds |
| `on-surface` | `#1A1C1B` | Primary text |
| `on-surface-variant` | `#404945` | Secondary text |
| `outline` | `#707974` | Borders |
| `outline-variant` | `#BFC9C3` | Subtle borders |

Plus shadcn tokens: `background`, `foreground`, `muted`, `accent`, `destructive`, `card`, `popover` via CSS vars.

## Layout Structure

```
src/app/layout.tsx           # Root: fonts, Toaster
src/app/(auth)/              # Login/register (no sidebar)
src/app/(dashboard)/
  ├── admin/layout.tsx       # Admin: sidebar + topbar wrapper
  │   ├── overview/          # Dashboard overview
  │   ├── users/             # User management
  │   ├── services/          # Service CRUD
  │   ├── categories/        # Category CRUD
  │   ├── queue/             # Execution queue monitor
  │   ├── devices/           # Agent device management
  │   ├── balance-requests/  # Top-up request approval
  │   ├── logs/              # Audit log viewer
  │   ├── analytics/         # Charts/stats
  │   └── admins/            # Admin user management
  └── user/layout.tsx        # User: simpler layout
      ├── dashboard/         # Wallet, quick actions
      ├── history/           # Transaction history
      ├── services/          # Browse & use services
      └── profile/           # User profile
```

## Key Admin Components (`src/components/admin/`)

| Component | Purpose |
|-----------|---------|
| `AdminSidebar.tsx` | Navigation sidebar with route links, collapse |
| `AdminTopbar.tsx` | Top bar with user info, notifications bell |
| `AdminGuard.tsx` | Redirects non-admin users |
| `StatusBadge.tsx` | Colored status pills (tx status, job status) |
| `DeviceStatusDot.tsx` | Online/offline/busy indicator dot |
| `ConfirmDialog.tsx` | Reusable confirmation modal |
| `AuditLogDrawer.tsx` | Slide-out drawer for log details |
| `ImageUpload.tsx` | Image upload with imgbb integration |
| `WalletAmount.tsx` | Formatted BDT amount display |
| `LogSeverityDot.tsx` | Colored severity indicator |
| `NotificationBell.tsx` | Bell icon with unread count + dropdown |

## Data Fetching Hooks (`src/lib/hooks/admin/`)

All use TanStack Query. Pattern: `useQuery` with `queryKey` and `queryFn` calling `fetch()`.

| Hook | Data |
|------|------|
| `useAdminStats` | Dashboard overview stats |
| `useUsers` | User list |
| `useAgentDevices` | Device list |
| `useExecutionQueue` | Job queue |
| `useAuditLogs` | Audit logs |
| `useBalanceRequests` | Balance request list |
| `useAnalyticsData` | Analytics charts data |
| `useOverviewQueueStatus` | Queue summary for overview |

## Client Actions (`src/lib/functions.ts`)

Typed wrappers around `fetch()` for all admin CRUD operations. Use `credentials: "include"` for cookie auth. Pattern:
```ts
export const doAction = (params) => apiFetch(url, { method, body: JSON.stringify(params) });
```

## Mutation Hook (`src/lib/hooks/useMutation.ts`)

Custom wrapper around TanStack's `useMutation` with toast integration (sonner).

## Validators (`src/lib/validators/index.ts`)

Zod schemas: `addBalanceSchema`, `rejectRequestSchema`, `approveRequestSchema`, `ussdStepSchema`, `ussdTemplateSchema`.
