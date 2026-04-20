# Auth Context
<!-- WHEN TO LOAD: Modifying login/logout, adding role checks, changing JWT logic, debugging auth issues, adding new protected routes. -->

## Two Auth Systems

### 1. Session Auth (Admin/User Web)

**Flow:** Login → verify password → sign JWT → set `__session` cookie → verify on each API request.

**Files:**
- `src/lib/auth/jwt.ts` — `signSessionToken()`, `verifySessionToken()` using `jose` (HS256)
- `src/lib/auth/session.ts` — `getSession()`, `requireSession()`, `requireAdmin()`, `withAdminSession()`
- `src/lib/auth/password.ts` — `hashPassword()`, `verifyPassword()` using bcrypt (12 rounds)
- `src/app/api/auth/session/route.ts` — POST (login), GET (whoami), DELETE (logout)

**Token details:**
- Algorithm: HS256
- Secret: `process.env.JWT_SECRET`
- Expiry: 14 days
- Cookie name: `__session`
- Payload: `{ sub: userId, email, role, displayName }`

**Guard pattern for admin routes:**
```ts
export async function GET(request: NextRequest) {
  return withAdminSession(request, async (session) => {
    // session.sub = userId, session.role = "admin"|"super_admin"|"support_admin"
    // ... handle request
  });
}
```

**Admin roles:** `admin`, `super_admin`, `support_admin` — all pass `requireAdmin()`.

### 2. Agent Auth (Flutter Device)

**Flow:** Admin generates registration token → device scans QR → calls `/api/agent/register` with token → server creates device record + per-device JWT → device stores JWT in secure storage.

**Files:**
- `src/lib/auth/jwt.ts` — `signAgentToken()`, `verifyAgentToken()`, `makeAgentSecret()`
- `src/app/api/agent/_auth.ts` — `extractAgentSession()` helper
- `android/lib/src/backend_service.dart` — stores JWT in `FlutterSecureStorage`

**Token details:**
- Algorithm: HS256
- Secret: **per-device** — `"agent-" + device.jwtSecret` (stored in AgentDevice document)
- Expiry: 365 days
- Header: `Authorization: Bearer <token>`
- Payload: `{ sub: authUid, deviceId, role: "agent" }`

**Agent auth verification flow:**
1. Extract `Authorization: Bearer <token>` header
2. Base64-decode JWT payload (without verification) to get `deviceId`
3. Fetch `AgentDevice` from DB by `deviceId`
4. Check device not revoked
5. Verify JWT signature using device's `jwtSecret`
6. Return `{ deviceId, authUid, device }`

**Guard pattern for agent routes:**
```ts
const agent = await extractAgentSession(request);
if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// agent.deviceId, agent.authUid, agent.device
```

## Client-Side Auth

- `src/lib/stores/auth.store.ts` — Zustand store: `{ user, role, loading }`
- `src/lib/hooks/useAuth.ts` — calls `GET /api/auth/session` on mount, populates store
- `src/components/admin/AdminGuard.tsx` — redirects to login if not admin

## Roles

| Role | Access |
|------|--------|
| `user` | User dashboard, submit recharges, view history |
| `admin` | Full admin panel access |
| `super_admin` | Same as admin (no distinction yet) |
| `support_admin` | Same as admin (limited scope planned) |
| `agent` | Device-only, no web access |
