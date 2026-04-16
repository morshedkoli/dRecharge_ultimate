# FinPay BD — Admin Dashboard Build Guide

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · shadcn/ui · Firebase (Firestore, Auth, Functions)  
**Role:** Admin only (custom claim `role: "admin"` enforced at middleware + component level)  
**Version:** 1.0 — includes Android USSD execution agent integration

---

## Table of Contents

1. [Overview](#1-overview)
2. [Route Structure](#2-route-structure)
3. [Layout & Navigation](#3-layout--navigation)
4. [Screen 1 — Dashboard Overview](#4-screen-1--dashboard-overview)
5. [Screen 2 — User Management](#5-screen-2--user-management)
6. [Screen 3 — Execution Queue Monitor](#6-screen-3--execution-queue-monitor)
7. [Screen 4 — Balance Requests](#7-screen-4--balance-requests)
8. [Screen 5 — USSD Template Manager](#8-screen-5--ussd-template-manager)
9. [Screen 6 — Android Device Manager](#9-screen-6--android-device-manager)
10. [Screen 7 — Audit Logs](#10-screen-7--audit-logs)
11. [Shared Components](#11-shared-components)
12. [Firestore Real-time Listeners](#12-firestore-real-time-listeners)
13. [Cloud Function Calls](#13-cloud-function-calls)
14. [Security Rules (Admin Scope)](#14-security-rules-admin-scope)
15. [File Structure](#15-file-structure)
16. [Build Order (Claude Code Prompts)](#16-build-order-claude-code-prompts)

---

## 1. Overview

The admin dashboard is a protected Next.js application that gives administrators full control over the FinPay BD system. All pages live under `/dashboard/admin/` and are protected at two levels: the `middleware.ts` checks the Firebase session cookie, and the `AdminGuard` component verifies the `admin` custom claim before rendering any content.

**Key responsibilities of this dashboard:**

- Monitor and manage user wallets and accounts
- Review and approve/reject balance top-up requests
- Monitor the execution queue — jobs dispatched to the Android agent
- Define USSD step templates for each payment provider
- Monitor Android agent devices (online/offline/busy status)
- View comprehensive audit logs with full device and location metadata
- Manually override stuck or failed jobs

**Design principles:**

- Real-time by default — all data tables use Firestore `onSnapshot` listeners, not one-time fetches
- No optimistic updates on financial operations — always wait for Cloud Function confirmation
- Every admin action is logged server-side before the UI updates
- Destructive actions (suspend user, force-fail job, reject request) require a confirmation dialog

---

## 2. Route Structure

```
/dashboard/admin/                          → redirect to /dashboard/admin/overview
/dashboard/admin/overview                  → Dashboard overview (stats + recent activity)
/dashboard/admin/users                     → User list
/dashboard/admin/users/[uid]               → User detail page
/dashboard/admin/queue                     → Execution queue monitor
/dashboard/admin/queue/[jobId]             → Job detail page
/dashboard/admin/balance-requests          → Balance top-up request queue
/dashboard/admin/ussd-templates            → USSD template manager
/dashboard/admin/ussd-templates/[provider] → Template editor for a specific provider
/dashboard/admin/devices                   → Android device manager
/dashboard/admin/logs                      → Audit log viewer
```

All routes are wrapped in `(dashboard)/admin/layout.tsx` which renders the shared sidebar navigation and top bar.

---

## 3. Layout & Navigation

### File: `app/(dashboard)/admin/layout.tsx`

**Left sidebar — navigation items:**

| Icon | Label | Route | Badge |
|------|-------|--------|-------|
| LayoutDashboard | Overview | /dashboard/admin/overview | — |
| Users | Users | /dashboard/admin/users | total user count |
| ListOrdered | Queue | /dashboard/admin/queue | pending job count (live) |
| Inbox | Balance Requests | /dashboard/admin/balance-requests | pending count (live) |
| Terminal | USSD Templates | /dashboard/admin/ussd-templates | — |
| Smartphone | Devices | /dashboard/admin/devices | offline device count |
| ScrollText | Audit Logs | /dashboard/admin/logs | — |

**Top bar contains:**
- App logo + "Admin Panel" label
- Logged-in admin email
- Sign out button

**Sidebar behavior:**
- Active route is highlighted
- Live badge counts update via Firestore listeners set up in the layout itself
- Mobile: collapses to an icon-only rail; hamburger opens a full drawer

---

## 4. Screen 1 — Dashboard Overview

**Route:** `/dashboard/admin/overview`  
**File:** `app/(dashboard)/admin/overview/page.tsx`

### 4.1 Stat Cards Row

Four metric cards displayed in a 2×2 grid on mobile, 4-column row on desktop:

| Card | Value Source | Update |
|------|-------------|--------|
| Total Users | `users` collection count | On mount |
| Pending Requests | `balanceRequests` where `status==pending` | Real-time |
| Jobs in Queue | `executionQueue` where `status==queued` | Real-time |
| Active Devices | `agentDevices` where `status==online` | Real-time |

### 4.2 Recent Activity Feed

A real-time list of the last 20 `auditLogs` documents ordered by `timestamp` descending. Each row shows:

- Severity indicator dot (info=blue, warn=amber, error=red, critical=red filled)
- Action string (e.g. `TX_COMPLETED`, `LOGIN_FAILED`)
- User identifier (uid truncated, or "anonymous")
- Location city + country
- Relative timestamp (e.g. "2 minutes ago")

Clicking a row opens a side drawer with the full log document.

### 4.3 Queue Status Bar

A visual indicator showing:
- Number of jobs: queued / processing / completed today / failed today
- Active device name and current job (if any device is processing)

---

## 5. Screen 2 — User Management

**Route:** `/dashboard/admin/users`  
**File:** `app/(dashboard)/admin/users/page.tsx`

### 5.1 User Table

Columns:

| Column | Source | Notes |
|--------|--------|-------|
| Name / Email | `users.displayName`, `users.email` | Sorted by name |
| Role | `users.role` | Badge: blue=user, red=admin |
| Wallet Balance | `users.walletBalance` | BDT formatted |
| Status | `users.status` | Badge: green=active, red=suspended |
| Last Login | `users.lastLoginAt` | Relative time |
| Actions | — | View, Suspend/Activate |

**Controls above table:**
- Search input — client-side filter on name/email
- Role filter dropdown: All / User / Admin
- Status filter: All / Active / Suspended

**Pagination:** 20 rows per page, Firestore cursor-based pagination using `startAfter`.

### 5.2 User Detail Page

**Route:** `/dashboard/admin/users/[uid]`  
**File:** `app/(dashboard)/admin/users/[uid]/page.tsx`

Sections:

**Profile section:**
- Avatar (initials circle), name, email, phone, role badge, status badge
- Created at, last login at
- `Suspend` / `Activate` button → calls `suspendUser` Cloud Function → confirmation dialog first

**Wallet section:**
- Current balance (large display)
- Wallet locked indicator (yellow warning if `walletLocked: true`)
- "Add Balance" button → opens modal with amount input → calls `adminAddBalance` Cloud Function

**Transaction history tab:**
- Table of all transactions for this user from `transactions` collection
- Columns: Date, Provider, Recipient (masked), Amount, Status, Job ID link

**Balance requests tab:**
- All balance requests from this user
- Columns: Date, Amount, Status, Admin note

**Audit logs tab:**
- All `auditLogs` where `uid == this user's uid`

---

## 6. Screen 3 — Execution Queue Monitor

**Route:** `/dashboard/admin/queue`  
**File:** `app/(dashboard)/admin/queue/page.tsx`

This is the most operationally critical screen. It shows the live state of the USSD execution pipeline.

### 6.1 Status Summary Row

Four count pills at the top:

- Queued (gray)
- Processing (blue, animated pulse dot)
- Completed Today (green)
- Failed Today (red)

### 6.2 Queue Table

Real-time listener on `executionQueue` ordered by `createdAt` descending. Default shows last 50 jobs.

Columns:

| Column | Source | Notes |
|--------|--------|-------|
| # | Position in queue | Only shown for queued jobs |
| User | `userId` → lookup name | Truncated |
| Provider | `provider` | Badge: bKash=pink, Nagad=orange, Rocket=blue |
| Recipient | `recipientNumber` | Show last 4 digits only: `****1234` |
| Amount | `amount` | BDT formatted |
| Status | `status` | Colored badge |
| Device | `lockedByDevice` | Device name from agentDevices |
| Created | `createdAt` | Relative time |
| Actions | — | View detail |

**Status badge colors:**
- `queued` → gray
- `processing` → blue (animated dot)
- `done` → green
- `failed` → red

**Filters:**
- Status filter: All / Queued / Processing / Done / Failed
- Provider filter: All / bKash / Nagad / Rocket
- Date range picker

### 6.3 Job Detail Page

**Route:** `/dashboard/admin/queue/[jobId]`  
**File:** `app/(dashboard)/admin/queue/[jobId]/page.tsx`

Sections:

**Job summary card:**
- All fields from the job document displayed in a 2-column grid
- Lock status with `lockedAt` and `lockedByDevice`
- Attempt number

**USSD execution log:**
- List of steps that were executed (from `ussdStepsExecuted` array in job doc)
- Each step: order number, type, value (recipient/amount replaced), result status

**SMS result card:**
- Raw SMS text (full, in a monospace code block)
- Parsed result: success/failure, extracted txRef, extracted amount
- Timestamp received

**Manual override section** (only shown if status is `queued` or `processing`):
- "Force Fail" button → confirmation dialog → calls `failTransaction` Cloud Function
- Warning: this immediately refunds the user's wallet

---

## 7. Screen 4 — Balance Requests

**Route:** `/dashboard/admin/balance-requests`  
**File:** `app/(dashboard)/admin/balance-requests/page.tsx`

### 7.1 Request Table

Real-time listener on `balanceRequests` where `status == "pending"` ordered by `createdAt` ascending (oldest first).

Columns:

| Column | Source |
|--------|--------|
| User | Name + email lookup from `userId` |
| Amount Requested | `amount` in BDT |
| User Note | `note` |
| Requested At | `createdAt` |
| Actions | Approve / Reject |

**Approve flow:**
1. Admin clicks "Approve"
2. Modal opens: shows user name, requested amount, optional "Admin note" text area
3. Admin clicks "Confirm Approve"
4. Calls `approveBalanceRequest` Cloud Function with `{ reqId, adminNote }`
5. On success: row disappears from pending table (real-time update)
6. Toast: "Balance of BDT X added to [user name]'s wallet"

**Reject flow:**
1. Admin clicks "Reject"
2. Modal opens: requires "Admin note" (mandatory for rejection — user can see this)
3. Admin clicks "Confirm Reject"
4. Calls `rejectBalanceRequest` Cloud Function with `{ reqId, adminNote }`
5. Toast: "Request rejected"

### 7.2 History Tab

Separate tab showing all processed requests (approved + rejected) with columns:
- User, Amount, Status badge, Admin note, Processed by (admin name), Processed at

---

## 8. Screen 5 — USSD Template Manager

**Route:** `/dashboard/admin/ussd-templates`  
**File:** `app/(dashboard)/admin/ussd-templates/page.tsx`

**Route:** `/dashboard/admin/ussd-templates/[provider]`  
**File:** `app/(dashboard)/admin/ussd-templates/[provider]/page.tsx`

### 8.1 Provider Selection

The index page shows three cards, one per provider:

- bKash — current USSD code, number of steps configured, last updated by, last updated at
- Nagad — same
- Rocket — same

Clicking a card navigates to the template editor for that provider.

### 8.2 Template Editor

**Top section — Basic config:**

| Field | Input | Notes |
|-------|-------|-------|
| Provider | Read-only label | bkash / nagad / rocket |
| USSD Code | Text input | e.g. `*247#` |
| SMS Timeout | Number input (seconds) | How long to wait for confirmation SMS |

**Middle section — Step Builder:**

A drag-and-drop ordered list of steps. Each step card contains:

- Drag handle (left side)
- Step number (auto-assigned, read-only)
- Type dropdown: `dial` / `select` / `input`
- Value field: text input
  - For `dial`: pre-filled with USSD code, disabled (always step 1)
  - For `select`: numeric value (menu option to press)
  - For `input`: text or template variable (`{{recipientNumber}}` / `{{amount}}`)
- Wait (ms): number input, slider from 0 to 5000ms
- Label: optional descriptive text for this step (admin notes only)
- Delete button (red trash icon)

"Add Step" button appends a new blank step at the bottom.

**Available template variables (shown as a reference strip above the step list):**
- `{{recipientNumber}}` — replaced at runtime with the job's recipient number
- `{{amount}}` — replaced at runtime with the job's amount

**Bottom section — SMS Pattern Editor:**

A list of pattern rules. Each rule card:

- Result type toggle: `success` / `failure`
- Regex input field (monospace font)
- Named groups: list of group name inputs (e.g. `amount`, `recipient`, `txRef`)
- Test button → opens inline tester

**SMS Pattern Tester (inline modal):**

- Text area: "Paste sample SMS here"
- Runs all patterns against the input in real time
- Shows which pattern matched, highlighted captures
- Shows extracted group values

**Save button:**
- Disabled until at least one change is made
- Calls `saveUssdTemplate` Cloud Function
- On success: shows "Template saved" toast + logs version to auditLogs
- Shows "Last saved by [admin email] at [time]" after save

**Version History (collapsible section at bottom):**

- Table of past saves: timestamp, saved by, number of steps
- "Preview" button on each row shows the template as it was at that point (read-only)

---

## 9. Screen 6 — Android Device Manager

**Route:** `/dashboard/admin/devices`  
**File:** `app/(dashboard)/admin/devices/page.tsx`

### 9.1 Device Cards Grid

Real-time listener on `agentDevices` collection. Each device displayed as a card:

**Card contents:**
- Device name (admin-given label)
- Status badge: Online (green) / Busy (blue, animated) / Offline (gray)
- SIM provider installed
- Last heartbeat: relative time (e.g. "12 seconds ago")
- Current job: if `status == "busy"`, show job ID as a link to queue detail page
- Device ID (truncated, monospace)
- Registered at

**Status logic (computed client-side from `lastHeartbeat`):**
- If `lastHeartbeat` is less than 60 seconds ago AND `currentJob` is set → Busy
- If `lastHeartbeat` is less than 60 seconds ago AND no `currentJob` → Online
- If `lastHeartbeat` is more than 60 seconds ago → Offline

**Card actions:**
- "Revoke Access" button → confirmation dialog → calls `revokeDevice` Cloud Function → logs `DEVICE_REVOKED` audit event

### 9.2 Register New Device

A panel below the device cards:

- Instructions section: step-by-step guide for setting up a new Android device
- "Generate Registration Token" button → calls `generateDeviceToken` Cloud Function → displays a one-time token
- The Android app uses this token on first launch to register itself and receive a Firebase credential

---

## 10. Screen 7 — Audit Logs

**Route:** `/dashboard/admin/logs`  
**File:** `app/(dashboard)/admin/logs/page.tsx`

### 10.1 Filter Bar

All filters are applied server-side via Firestore query composition:

| Filter | Input Type | Firestore Field |
|--------|-----------|----------------|
| Search | Text input | `action` contains (client-side) |
| Action type | Multi-select dropdown | `action` == selected |
| Severity | Multi-select: info / warn / error / critical | `severity` |
| User | Text input (UID or email) | `uid` |
| Device | Dropdown (from agentDevices) | `meta.deviceId` |
| Date from | Date picker | `timestamp` >= |
| Date to | Date picker | `timestamp` <= |

"Clear filters" button resets all to defaults.

### 10.2 Log Table

Paginated, 50 rows per page, ordered by `timestamp` descending.

Columns:

| Column | Notes |
|--------|-------|
| Severity | Colored dot + text |
| Action | Monospace badge |
| User | UID truncated + email if available |
| Location | City, Country flag emoji |
| Device | Browser name + OS |
| Device type | Mobile / Desktop / Tablet |
| Entity | txId / jobId / reqId (linked) |
| Timestamp | Full datetime, hover shows relative |

### 10.3 Log Detail Drawer

Clicking any row opens a right-side drawer with the full log document:

**Sections in drawer:**

- **Event** — action, severity, timestamp
- **User** — uid, email, role at time of event
- **Network** — IP (hashed), city, region, country, ISP (if available)
- **Device** — browser name, browser version, OS name, OS version, device type
- **Entity** — linked entityId (clickable to navigate to that transaction/job/request)
- **Metadata** — raw `meta` object displayed as formatted JSON
- **Raw document** — collapsible full Firestore document as JSON

### 10.4 Export

"Export CSV" button at top-right of filter bar:
- Applies current filters
- Downloads up to 1000 rows as CSV
- Columns: timestamp, action, severity, uid, city, country, browser, os, deviceType, entityId

---

## 11. Shared Components

All components live in `src/components/admin/`.

### `AdminGuard`

```tsx
// components/admin/AdminGuard.tsx
// Wraps every admin page
// Reads role from useAuth() hook
// Renders children if role == "admin"
// Renders <AccessDenied /> component otherwise
// Never shows a loading flash — uses a skeleton while verifying
```

### `ConfirmDialog`

Reusable confirmation modal used for all destructive actions.

Props:
- `title: string`
- `description: string`
- `confirmLabel: string` (e.g. "Yes, suspend user")
- `confirmVariant: "destructive" | "default"`
- `onConfirm: () => Promise<void>`
- `loading: boolean`

### `StatusBadge`

Renders a colored pill for any status field.

```tsx
// Usage examples:
<StatusBadge status="queued" />    // gray
<StatusBadge status="processing" /> // blue + animated dot
<StatusBadge status="complete" />   // green
<StatusBadge status="failed" />     // red
<StatusBadge status="pending" />    // amber
<StatusBadge status="active" />     // green
<StatusBadge status="suspended" />  // red
```

### `ProviderBadge`

```tsx
<ProviderBadge provider="bkash" />   // pink badge "bKash"
<ProviderBadge provider="nagad" />   // orange badge "Nagad"
<ProviderBadge provider="rocket" />  // blue badge "Rocket"
```

### `WalletAmount`

```tsx
// Renders BDT amounts with consistent formatting
<WalletAmount amount={1500} />  // "৳ 1,500.00"
```

### `DeviceStatusDot`

```tsx
// Animated green dot for "online", animated blue for "busy", gray for "offline"
<DeviceStatusDot status="busy" />
```

### `LogSeverityDot`

```tsx
<LogSeverityDot severity="critical" /> // filled red dot
<LogSeverityDot severity="error" />    // red dot
<LogSeverityDot severity="warn" />     // amber dot
<LogSeverityDot severity="info" />     // blue dot
```

---

## 12. Firestore Real-time Listeners

All real-time data is managed through custom hooks. Each hook returns `{ data, loading, error }`.

```
hooks/admin/
  useAdminStats.ts          → counts for overview cards
  useUsers.ts               → paginated users with filters
  useUserDetail.ts          → single user + their transactions/requests/logs
  useExecutionQueue.ts      → real-time queue with filters
  useJobDetail.ts           → single job document
  useBalanceRequests.ts     → pending requests, real-time
  useUssdTemplate.ts        → template for a given provider
  useAgentDevices.ts        → all devices, real-time
  useAuditLogs.ts           → paginated logs with filters
  useLiveActivityFeed.ts    → last 20 audit logs for overview page
```

**Listener teardown:** All hooks must unsubscribe the Firestore listener in their `useEffect` cleanup function to prevent memory leaks when navigating between admin pages.

**Error handling:** If a listener errors (e.g. permission denied after session expiry), redirect to `/login` with a toast "Session expired, please sign in again."

---

## 13. Cloud Function Calls

All calls use the Firebase callable functions SDK (`httpsCallable`). Every call:
1. Automatically includes the current user's ID token in the Authorization header
2. The Cloud Function verifies the token AND checks `role == "admin"` before executing
3. Returns `{ success: boolean, data?: any, error?: string }`

```
Admin-callable functions:
  suspendUser({ uid })
  activateUser({ uid })
  adminAddBalance({ uid, amount, note })
  approveBalanceRequest({ reqId, adminNote })
  rejectBalanceRequest({ reqId, adminNote })
  failTransaction({ txId, jobId, reason })         // force-fail a stuck job
  saveUssdTemplate({ provider, ussdCode, steps, smsPatterns, smsTimeout })
  generateDeviceToken()                             // returns one-time registration token
  revokeDevice({ deviceId })
  setUserRole({ uid, role })                        // promote/demote admin
```

**Error display:** All Cloud Function errors are caught and shown as a toast with the error message. Never silently swallow errors on financial operations.

---

## 14. Security Rules (Admin Scope)

```javascript
// Firestore security rules relevant to admin operations

// Users collection — admin can read all, users read own only
match /users/{uid} {
  allow read: if isAdmin() || request.auth.uid == uid;
  allow write: if false; // Cloud Functions only
}

// Execution queue — admin read only, no client writes
match /executionQueue/{jobId} {
  allow read: if isAdmin() || isAgent();
  allow write: if false; // Cloud Functions only
}

// Audit logs — admin read only, no client writes ever
match /auditLogs/{logId} {
  allow read: if isAdmin();
  allow write: if false; // Cloud Functions only
}

// USSD templates — admin read/write via CF, agents read only
match /ussdTemplates/{provider} {
  allow read: if isAdmin() || isAgent();
  allow write: if false; // Cloud Functions only
}

// Agent devices — admin read all, device writes own heartbeat only
match /agentDevices/{deviceId} {
  allow read: if isAdmin();
  allow update: if isAgent() && request.auth.uid == resource.data.authUid
                && request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['lastHeartbeat', 'status', 'currentJob']);
}

// Helper functions
function isAdmin() {
  return request.auth != null && request.auth.token.role == 'admin';
}
function isAgent() {
  return request.auth != null && request.auth.token.role == 'agent';
}
```

---

## 15. File Structure

```
src/
├── app/
│   └── (dashboard)/
│       └── admin/
│           ├── layout.tsx                    ← sidebar + topbar
│           ├── overview/
│           │   └── page.tsx
│           ├── users/
│           │   ├── page.tsx
│           │   └── [uid]/
│           │       └── page.tsx
│           ├── queue/
│           │   ├── page.tsx
│           │   └── [jobId]/
│           │       └── page.tsx
│           ├── balance-requests/
│           │   └── page.tsx
│           ├── ussd-templates/
│           │   ├── page.tsx
│           │   └── [provider]/
│           │       └── page.tsx
│           ├── devices/
│           │   └── page.tsx
│           └── logs/
│               └── page.tsx
│
├── components/
│   └── admin/
│       ├── AdminGuard.tsx
│       ├── AdminSidebar.tsx
│       ├── AdminTopbar.tsx
│       ├── ConfirmDialog.tsx
│       ├── StatusBadge.tsx
│       ├── ProviderBadge.tsx
│       ├── WalletAmount.tsx
│       ├── DeviceStatusDot.tsx
│       ├── LogSeverityDot.tsx
│       ├── LogDetailDrawer.tsx
│       ├── UssdStepBuilder.tsx               ← drag-and-drop step editor
│       ├── SmsPatternEditor.tsx              ← regex pattern editor + tester
│       ├── JobDetailDrawer.tsx               ← side drawer for queue job detail
│       └── LiveActivityFeed.tsx              ← real-time feed for overview
│
└── hooks/
    └── admin/
        ├── useAdminStats.ts
        ├── useUsers.ts
        ├── useUserDetail.ts
        ├── useExecutionQueue.ts
        ├── useJobDetail.ts
        ├── useBalanceRequests.ts
        ├── useUssdTemplate.ts
        ├── useAgentDevices.ts
        ├── useAuditLogs.ts
        └── useLiveActivityFeed.ts
```

---

## 16. Build Order (Claude Code Prompts)

Follow this exact order. Each prompt builds on the previous.

---

### Prompt 1 — Admin layout and navigation

```
Build the admin dashboard layout for a Next.js 14 App Router project.

File: src/app/(dashboard)/admin/layout.tsx

Requirements:
- Left sidebar with navigation links to: /dashboard/admin/overview, /users, /queue,
  /balance-requests, /ussd-templates, /devices, /logs
- Use lucide-react icons: LayoutDashboard, Users, ListOrdered, Inbox, Terminal,
  Smartphone, ScrollText
- Sidebar has live badge counts: pending balance requests count, pending queue jobs count
  — both from Firestore real-time listeners set up inside the layout
- Top bar shows admin email from useAuth() hook and a sign-out button
- Active link is highlighted using usePathname()
- Mobile: sidebar collapses; hamburger button toggles a full drawer overlay
- AdminGuard component (src/components/admin/AdminGuard.tsx) wraps the children:
  reads role from Firebase custom claims via useAuth(), shows AccessDenied if not admin
- Use shadcn/ui components (Sheet for mobile drawer, Badge for counts)
- Tailwind CSS styling only, no inline styles
```

---

### Prompt 2 — Shared components

```
Build these shared components for the admin dashboard:

1. src/components/admin/StatusBadge.tsx
   - Props: status: "queued"|"processing"|"done"|"failed"|"pending"|"active"|"suspended"|"approved"|"rejected"
   - Each status gets a specific color: queued=gray, processing=blue with animated pulse dot,
     done/active/approved=green, failed/suspended/rejected=red, pending=amber
   - Returns a <span> with rounded pill styling

2. src/components/admin/ProviderBadge.tsx
   - Props: provider: "bkash"|"nagad"|"rocket"
   - bKash=pink, Nagad=orange, Rocket=blue

3. src/components/admin/ConfirmDialog.tsx
   - Props: title, description, confirmLabel, confirmVariant ("destructive"|"default"),
     onConfirm: () => Promise<void>, open, onOpenChange, loading
   - Uses shadcn/ui AlertDialog
   - Shows spinner on confirmLabel button while loading=true

4. src/components/admin/WalletAmount.tsx
   - Props: amount: number
   - Renders: ৳ 1,500.00 (Bangladesh Taka symbol, comma-separated, 2 decimal)

5. src/components/admin/LogSeverityDot.tsx
   - Props: severity: "info"|"warn"|"error"|"critical"
   - Small colored circle: info=blue, warn=amber, error=red, critical=red filled larger

6. src/components/admin/DeviceStatusDot.tsx
   - Props: status: "online"|"busy"|"offline"
   - Animated pulse for online (green) and busy (blue), static gray for offline
```

---

### Prompt 3 — Overview page

```
Build the admin overview page at src/app/(dashboard)/admin/overview/page.tsx

Sections:
1. Stat cards row (4 cards):
   - Total Users: query users collection count on mount
   - Pending Requests: real-time count of balanceRequests where status=="pending"
   - Jobs in Queue: real-time count of executionQueue where status=="queued"
   - Active Devices: real-time count of agentDevices where status=="online"

2. Live activity feed (src/components/admin/LiveActivityFeed.tsx):
   - Real-time onSnapshot listener on auditLogs, ordered by timestamp desc, limit 20
   - Each row: LogSeverityDot, action (monospace), uid (truncated), city + country, relative time
   - Clicking a row opens LogDetailDrawer (build a simple version: full doc as formatted JSON in a Sheet)

3. Queue status bar:
   - Shows counts: queued, processing, completed today, failed today
   - If any device has status=="busy", show "Device [name] processing job [jobId]"

Use Firestore onSnapshot for all real-time data. Unsubscribe in useEffect cleanup.
Use shadcn/ui Card for stat cards. Use Tailwind for layout.
```

---

### Prompt 4 — User management

```
Build the user management screens.

1. src/app/(dashboard)/admin/users/page.tsx
   - Firestore paginated query on users collection, 20 per page, cursor-based with startAfter
   - Columns: Name/Email, Role badge, Wallet Balance (WalletAmount component), Status badge,
     Last Login (relative time), Actions (View button → navigate to /admin/users/[uid])
   - Above table: search input (client-side filter on displayName/email),
     role filter dropdown, status filter dropdown
   - Use shadcn/ui Table, Input, Select

2. src/app/(dashboard)/admin/users/[uid]/page.tsx
   - Real-time listener on users/{uid} document
   - Profile section: avatar circle (initials), name, email, role, status
   - "Suspend" / "Activate" button → ConfirmDialog → call suspendUser / activateUser
     Cloud Function via httpsCallable → show toast on success/error
   - "Add Balance" button → Dialog with amount input and note → call adminAddBalance CF
   - Three tabs using shadcn/ui Tabs: Transactions, Balance Requests, Audit Logs
     - Each tab queries its respective collection filtered by userId
     - Transactions tab: columns Date, Provider (ProviderBadge), Recipient (last 4 only),
       Amount (WalletAmount), Status (StatusBadge), Job ID link
```

---

### Prompt 5 — Execution queue monitor

```
Build the execution queue monitor at src/app/(dashboard)/admin/queue/page.tsx

1. Status summary row: 4 colored count pills (queued/processing/completed today/failed today)
   All from real-time Firestore listeners.

2. Queue table with real-time onSnapshot on executionQueue, limit 50, ordered by createdAt desc:
   - Columns: User (name lookup), Provider (ProviderBadge), Recipient (show ****XXXX last 4 only),
     Amount (WalletAmount), Status (StatusBadge), Device (agentDevices name lookup),
     Created (relative time), Actions (View button)
   - Filter controls: status filter, provider filter, date range picker
   - Clicking View → navigate to /admin/queue/[jobId]

3. Job detail page src/app/(dashboard)/admin/queue/[jobId]/page.tsx:
   - Real-time listener on executionQueue/{jobId}
   - Summary card: all fields in 2-column grid
   - USSD steps section: ordered list of ussdStepsExecuted array items
   - SMS result card: rawSms in <code> block, parsedResult fields
   - Manual override section: shown only if status is queued or processing:
     "Force Fail" button → ConfirmDialog (warning: user wallet will be refunded)
     → calls failTransaction Cloud Function with txId and jobId
```

---

### Prompt 6 — Balance requests

```
Build src/app/(dashboard)/admin/balance-requests/page.tsx

Two tabs: Pending | History

Pending tab:
- Real-time onSnapshot on balanceRequests where status=="pending", ordered by createdAt asc
- Columns: User (name lookup), Amount Requested, User Note, Requested At, Actions
- Approve button → Dialog with optional admin note field → calls approveBalanceRequest CF
  → success: toast "Balance of ৳X added to [name]'s wallet"
- Reject button → Dialog with REQUIRED admin note field → calls rejectBalanceRequest CF
  → validate note not empty before calling

History tab:
- Paginated query on balanceRequests where status != "pending", ordered by processedAt desc
- Columns: User, Amount, Status badge, Admin Note, Processed By (admin name lookup),
  Processed At
- 20 rows per page with load more button

Use ConfirmDialog component for both approve and reject flows.
Show loading spinner on action buttons while CF call is in progress.
```

---

### Prompt 7 — USSD template manager

```
Build the USSD template manager.

1. src/app/(dashboard)/admin/ussd-templates/page.tsx
   - Three cards for bkash, nagad, rocket
   - Each card: provider name, USSD code configured, step count, last updated by + at
   - Card click → navigate to /admin/ussd-templates/[provider]

2. src/app/(dashboard)/admin/ussd-templates/[provider]/page.tsx

Top section - basic config inputs:
- USSD Code text input (e.g. *247#)
- SMS Timeout number input in seconds

Middle section - Step Builder (src/components/admin/UssdStepBuilder.tsx):
- Use @dnd-kit/core and @dnd-kit/sortable for drag and drop
- Each step card: drag handle, step number (read-only), type dropdown (dial/select/input),
  value text input, waitMs number input (0-5000), label text input, delete button
- Step type "dial" is always step 1 and its value is locked to the USSD code field
- Add Step button appends a new empty step

Available variables reference strip above step list:
- Shows {{recipientNumber}} and {{amount}} as copy-able chips

Bottom section - SMS Pattern Editor (src/components/admin/SmsPatternEditor.tsx):
- List of pattern rules
- Each rule: result toggle (success/failure), regex input (monospace), named groups list
- Add Pattern button
- Test button per rule → inline tester: paste sample SMS → shows match result and extracted groups

Save button:
- Disabled if no changes
- Calls saveUssdTemplate Cloud Function
- Shows "Last saved by [admin email] at [time]" subtitle
- Collapsed version history section: table of past saves (from auditLogs filtered by
  action==TEMPLATE_UPDATED and meta.provider==[provider])
```

---

### Prompt 8 — Device manager

```
Build src/app/(dashboard)/admin/devices/page.tsx

Device cards grid (real-time onSnapshot on agentDevices):
- Each card: device name, DeviceStatusDot + status label, SIM provider, last heartbeat
  (relative time), current job link if busy, device ID (truncated monospace), registered at
- Status computed from lastHeartbeat: if > 60s ago → offline regardless of status field
- Revoke Access button → ConfirmDialog → calls revokeDevice CF

Register new device panel below cards:
- Instructional text: "Install the FinPay Agent APK on the device. On first launch,
  enter this registration token."
- Generate Token button → calls generateDeviceToken CF → shows returned token in a
  large monospace display with a copy button
- Token expires after 10 minutes (show countdown timer)
- Warning: "This token grants the device access to execute payment jobs. Do not share it."
```

---

### Prompt 9 — Audit log viewer

```
Build src/app/(dashboard)/admin/logs/page.tsx

Filter bar (all filters compose a Firestore query):
- Action type multi-select: list of known action strings as checkboxes in a dropdown
- Severity multi-select: info, warn, error, critical
- User UID text input
- Device dropdown populated from agentDevices names
- Date from + Date to: date pickers using shadcn/ui Calendar
- Clear filters button

Log table - paginated 50 rows, Firestore cursor pagination:
- Columns: Severity (LogSeverityDot), Action (monospace badge), User (uid truncated),
  Location (city + country), Device (browser + OS), Device type, Entity ID (linked),
  Timestamp (full datetime, hover shows relative)
- Click row → right-side Sheet drawer (src/components/admin/LogDetailDrawer.tsx)

LogDetailDrawer sections:
- Event: action, severity, full timestamp
- User: uid, email, role at time
- Network: hashed IP, city, region, country
- Device: browser name+version, OS name+version, device type, session ID
- Entity: entityId with link to relevant resource (tx/job/request)
- Metadata: meta object as formatted JSON (<pre> tag, monospace, scrollable)
- Raw document: collapsible full Firestore document as formatted JSON

Export CSV button:
- Applies current filters, fetches up to 1000 docs
- Creates and downloads CSV with columns: timestamp, action, severity, uid, city,
  country, browser, os, deviceType, entityId
```

---

### Prompt 10 — Polish and wiring

```
Final pass on the admin dashboard:

1. Add error boundaries to each page — if a page throws, show an error card with
   "Something went wrong" and a retry button instead of a blank screen

2. Add loading skeletons to all tables — while the first snapshot loads, show shimmer
   rows using shadcn/ui Skeleton component. Never show an empty table before data loads.

3. Add toast notifications using shadcn/ui Toaster:
   - Success: green, 3 second auto-dismiss
   - Error: red, stays until dismissed, includes error message from Cloud Function

4. Test all Firestore listener cleanup:
   - Navigate rapidly between admin pages and confirm no "Can't perform state update
     on unmounted component" warnings in console

5. Add the middleware check in src/middleware.ts:
   - If the route starts with /dashboard/admin, verify the session cookie contains
     role=="admin" custom claim using Firebase Admin SDK
   - If not admin: redirect to /dashboard (user dashboard) with a flash message
   - If not authenticated: redirect to /login

6. Ensure all number displays use WalletAmount or Intl.NumberFormat —
   no raw number rendering anywhere in the admin UI
```

---

*End of Admin Dashboard Build Guide*

**Next steps after admin dashboard:**
- Build the Android agent app (Phase 5 of the main plan)
- Set up Firebase Emulator Suite for local testing before deploy
- Write Firestore security rules unit tests using `@firebase/rules-unit-testing`
