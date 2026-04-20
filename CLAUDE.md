# dRecharge — Project Context

Automated mobile recharge platform. Users submit recharge requests via admin dashboard → backend queues execution jobs → Flutter Android agent dials USSD codes on a physical phone → confirms via SMS → reports result back.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Next.js Admin   │────▶│  MongoDB Atlas    │◀────│  Flutter Agent   │
│  (React 18 + API │     │  (Mongoose 9)     │     │  (Dart 3, REST)  │
│   Routes)        │     └──────────────────┘     │  USSD + SMS      │
└─────────────────┘                                └─────────────────┘
```

**Web stack:** Next.js 16 · React 18 · TypeScript · Tailwind 3 · Radix UI · TanStack Query · Zustand · Zod · jose (JWT)
**Mobile stack:** Flutter 3.x · Dart 3 · http · flutter_secure_storage · shared_preferences
**Database:** MongoDB via Mongoose 9 (string `_id` everywhere, `nanoid`)
**Auth:** JWT (HS256) — session tokens (14d, cookie `__session`) + per-device agent tokens (365d, `Authorization: Bearer`)

## Key Directories

```
src/
├── app/(auth)/          # Login/register pages
├── app/(dashboard)/
│   ├── admin/           # Admin pages: overview, users, services, categories, queue, devices, logs, balance-requests, analytics
│   └── user/            # User pages: dashboard, history, services, profile
├── app/api/
│   ├── admin/           # Admin API routes (session-auth, role-gated)
│   ├── agent/           # Agent API routes (device JWT-auth)
│   ├── auth/            # Login/session endpoints
│   └── ...              # Public: transactions, services, categories, notifications, balance-requests
├── components/
│   ├── admin/           # AdminSidebar, AdminTopbar, StatusBadge, ConfirmDialog, etc.
│   └── ui/              # shadcn/ui primitives (empty — uses Radix directly)
├── lib/
│   ├── auth/            # jwt.ts, session.ts, password.ts
│   ├── db/              # mongoose.ts, audit.ts, models/
│   ├── hooks/           # useAuth, useMutation, admin data hooks
│   ├── stores/          # Zustand auth store
│   ├── validators/      # Zod schemas
│   ├── functions.ts     # Client-side API call wrappers
│   ├── notifications.ts # Server-side notification helpers
│   └── ussd.ts          # USSD step normalization & placeholder resolution
├── types/index.ts       # All frontend TypeScript interfaces
android/                 # Flutter agent app
├── lib/src/
│   ├── agent_app.dart   # Main agent UI + USSD execution logic (80KB)
│   ├── backend_service.dart # REST API client + SMS matching
│   ├── models.dart      # Dart data models: ExecutionJob, UssdStep, etc.
│   └── native_bridge.dart  # Platform channel for native USSD/SMS
```

## Context Load Map

Load only what you need per task:

| Task | Load |
|------|------|
| API routes, endpoints, request/response | `context/API.md` |
| Database models, schemas, relationships | `context/DB.md` |
| Admin/User UI, pages, components | `context/UI.md` |
| Auth flow, JWT, sessions, roles | `context/AUTH.md` |
| USSD execution, agent, SMS matching | `context/AGENT.md` |
| Coding patterns, conventions, rules | `context/RULES.md` |

## Environment Variables

```
MONGODB_URI          # MongoDB connection string
JWT_SECRET           # Session JWT signing secret
AGENT_JWT_SECRET     # (legacy, per-device secrets in DB now)
NEXT_PUBLIC_API_BASE_URL   # Base URL for Flutter agent
NEXT_PUBLIC_IMGBB_API_KEY  # Image upload API key
```

## Run Commands

```bash
npm run dev          # Next.js dev server (port 3000)
cd android && flutter run  # Flutter agent (emulator or device)
```
