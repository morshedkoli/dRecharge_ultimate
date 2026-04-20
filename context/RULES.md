# Rules & Conventions
<!-- WHEN TO LOAD: Starting new features, onboarding, code review, or when unsure about project patterns. -->

## Code Patterns

### API Route Pattern
```ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongoose";
import { withAdminSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    await connectDB();
    // ... query models
    return NextResponse.json({ data });
  });
}
```

### Agent Route Pattern
```ts
import { extractAgentSession } from "../_auth";

export async function POST(request: NextRequest) {
  const agent = await extractAgentSession(request);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  // ... use agent.deviceId, agent.device
}
```

### Data Hook Pattern
```ts
export function useThings() {
  return useQuery({
    queryKey: ["admin", "things"],
    queryFn: async () => {
      const res = await fetch("/api/admin/things", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}
```

### Client Action Pattern
```ts
export const doAction = (id: string, payload: object) =>
  apiFetch(`/api/admin/things/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
```

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Models | PascalCase, singular | `User`, `ExecutionJob` |
| Interfaces | `I` prefix for Mongoose docs | `IUser`, `IExecutionJob` |
| Frontend types | PascalCase, no prefix | `AppUser`, `Transaction` |
| API routes | kebab-case directories | `balance-requests/`, `admin/queue/` |
| Hooks | `use` prefix | `useAuth`, `useExecutionQueue` |
| Stores | `*.store.ts` | `auth.store.ts` |
| Enums | union string types | `type TxStatus = "pending" \| "complete"` |
| IDs | `_id` in DB, `id`/`uid`/`jobId`/`txId` in frontend | |

## Key Rules

1. **Always `await connectDB()`** before any Mongoose operation
2. **String `_id`** everywhere — use `nanoid()` to generate
3. **Never throw in notifications/audit** — wrap in try/catch, log silently
4. **`withAdminSession()`** for all admin routes — handles 401/403 automatically
5. **`extractAgentSession()`** for all agent routes — returns null if unauthorized
6. **Structured `ussdSteps`** is source of truth — legacy `ussdFlow` string is deprecated
7. **Placeholders** in service templates: `{recipientNumber}`, `{amount}`, `{pin}` — resolved server-side before sending to agent
8. **`failureSmsTemplates[]`** array is source of truth for failure matching — each has `template` (SMS pattern) + `message` (user-facing reason)
9. **Notifications** use `recipientUid: "admin"` for admin-broadcast
10. **Wallet operations** are direct field updates (`$inc`) — no separate ledger

## File Organization

- **One model per file** in `src/lib/db/models/`
- **Frontend types mirrored** in `src/types/index.ts` (use `id` not `_id`)
- **API wrappers** all in `src/lib/functions.ts`
- **Notification helpers** all in `src/lib/notifications.ts`
- **Validators** all in `src/lib/validators/index.ts`

## Currency

All amounts in BDT (Bangladeshi Taka). Format: `৳` symbol, `en-BD` locale. Helper: `fmt(n)` in notifications.

## Security Headers (next.config.mjs)

`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `HSTS: max-age=31536000`.

## Don't

- Don't use Firebase SDK — fully migrated to MongoDB + custom JWT
- Don't use ObjectId — always string `_id` with nanoid
- Don't use `populate()` — manual joins only
- Don't add `createdAt` manually — use Mongoose timestamps option
- Don't put business logic in components — keep in API routes and `functions.ts`
