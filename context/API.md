# API Context
<!-- WHEN TO LOAD: Building, modifying, or debugging API routes. Adding new endpoints. Changing request/response formats. -->

## Pattern

All API routes are Next.js App Router route handlers (`route.ts`). Every admin route uses `withAdminSession()` wrapper from `src/lib/auth/session.ts`. Agent routes use `extractAgentSession()` from `src/app/api/agent/_auth.ts`.

**Standard response shape:**
```ts
// Success
NextResponse.json({ ...data }, { status: 200 })
// Error
NextResponse.json({ error: "message" }, { status: 4xx|5xx })
```

**Every route handler must:**
1. Call `connectDB()` before any DB operation
2. Use appropriate auth guard
3. Return `NextResponse.json()`

---

## Admin API (`/api/admin/*`) — requires session cookie, admin role

### Users
| Method | Path | Body / Params | Action |
|--------|------|---------------|--------|
| GET | `/api/admin/users` | — | List all users |
| POST | `/api/admin/users` | `{email, password, displayName, phoneNumber?}` | Create user account |
| PATCH | `/api/admin/users/[uid]` | `{action: "suspend"\|"activate"\|"setRole"\|"addBalance", role?, amount?, note?}` | User management actions |

### Services
| Method | Path | Body | Action |
|--------|------|------|--------|
| GET | `/api/admin/services` | — | List services (optionally with categories) |
| POST | `/api/admin/services` | `{name, ussdSteps[], pin, simSlot, successSmsFormat, failureSmsTemplates[], smsTimeout, ...}` | Create service |
| PATCH | `/api/admin/services/[id]` | Same as POST body | Update service |
| DELETE | `/api/admin/services/[id]` | — | Delete service |

### Categories
| Method | Path | Body | Action |
|--------|------|------|--------|
| GET | `/api/admin/categories` | — | List categories |
| POST | `/api/admin/categories` | `{name, logo}` | Create category |
| PATCH | `/api/admin/categories/[id]` | `{name, logo}` | Update |
| DELETE | `/api/admin/categories/[id]` | — | Delete |

### Execution Queue
| Method | Path | Body | Action |
|--------|------|------|--------|
| GET | `/api/admin/queue` | — | List all jobs |
| PATCH | `/api/admin/queue` | `{jobId, txId, reason}` | Fail a job manually |
| PATCH | `/api/admin/queue/[jobId]` | `{txId, isSuccess}` | Simulate job result |
| DELETE | `/api/admin/queue/[jobId]` | `{reason}` | Cancel job |

### Transactions
| Method | Path | Body | Action |
|--------|------|------|--------|
| GET | `/api/admin/transactions` | — | List transactions |
| POST | `/api/admin/transactions` | `{serviceId, recipientNumber, amount}` | Initiate transaction → creates job |

### Balance Requests
| Method | Path | Body | Action |
|--------|------|------|--------|
| GET | `/api/admin/balance-requests` | — | List requests |
| POST | `/api/admin/balance-requests` | `{amount, medium?, note?}` | Submit request |
| PATCH | `/api/admin/balance-requests/[id]` | `{action: "approve"\|"reject", adminNote?}` | Process request |

### Devices
| Method | Path | Action |
|--------|------|--------|
| POST | `/api/admin/devices/token` | Generate registration token |
| GET | `/api/admin/devices/endpoint` | Get agent API endpoint URL |
| POST | `/api/admin/devices/[deviceId]/revoke` | Revoke device |
| POST | `/api/admin/devices/[deviceId]/power` | Toggle power `{isPoweredOn}` |

### Logs
| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/logs` | Audit logs (paginated) |

---

## Agent API (`/api/agent/*`) — requires `Authorization: Bearer <device-jwt>`

Auth extracted via `extractAgentSession()` → decodes JWT without verification first to get `deviceId`, fetches device from DB, verifies JWT with per-device `jwtSecret`.

| Method | Path | Body | Action |
|--------|------|------|--------|
| POST | `/api/agent/register` | `{token, name, simProvider, ...}` | Register new device (no auth needed) |
| POST | `/api/agent/heartbeat` | `{currentJob?, simProvider?, isPoweredOn}` | Heartbeat + status update |
| GET | `/api/agent/queue` | — | Fetch next queued job (atomic lock) |
| GET | `/api/agent/queue/[jobId]` | — | Fetch specific job |
| POST | `/api/agent/queue/[jobId]/lock` | `{}` | Acquire job lock |
| POST | `/api/agent/queue/[jobId]/result` | `{txId, rawSms, parsedResult, ussdStepsExecuted}` | Report job completion |
| GET | `/api/agent/services/[serviceId]` | — | Get service config |
| GET | `/api/agent/bootstrap` | — | Health check (no auth) |

---

## Public/User API

| Method | Path | Auth | Action |
|--------|------|------|--------|
| POST | `/api/auth/session` | — | Login (`{email, password}`) → sets `__session` cookie |
| GET | `/api/auth/session` | cookie | Get current session/user |
| DELETE | `/api/auth/session` | cookie | Logout |
| GET | `/api/transactions` | cookie | User's transactions |
| GET | `/api/services` | — | Public active services list |
| GET | `/api/categories` | — | Public categories |
| GET | `/api/notifications` | cookie | User notifications |
| PATCH | `/api/notifications/[id]` | cookie | Mark notification read |
| GET/POST | `/api/balance-requests` | cookie | User balance request operations |

---

## Client-Side API Wrappers

`src/lib/functions.ts` exports typed wrappers for all admin API calls. Uses `apiFetch()` helper with `credentials: "include"`. Data hooks in `src/lib/hooks/admin/` use TanStack Query + these wrappers.
