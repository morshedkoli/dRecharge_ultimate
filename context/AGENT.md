# Agent Context
<!-- WHEN TO LOAD: Modifying Flutter agent, USSD execution, SMS matching, job lifecycle, device management, agent API. -->

## Overview

Flutter Android app that runs on a physical phone. Polls the backend for queued jobs, dials USSD codes, waits for SMS confirmation, reports results. Communicates exclusively via REST API.

## Tech Stack

- **Flutter** (Dart 3, SDK ^3.11.4)
- **http** — REST client
- **flutter_secure_storage** — JWT + device credentials
- **shared_preferences** — config (base URL, device name, power state)
- **device_info_plus** / **package_info_plus** — device metadata
- **permission_handler** — runtime permissions
- **mobile_scanner** — QR code scanning for registration

## Key Files

| File | Size | Purpose |
|------|------|---------|
| `android/lib/src/agent_app.dart` | 80KB | Main UI + USSD execution state machine |
| `android/lib/src/backend_service.dart` | 17KB | REST API client + SMS matching logic |
| `android/lib/src/models.dart` | 11KB | Data models (ExecutionJob, UssdStep, etc.) |
| `android/lib/src/native_bridge.dart` | 2KB | Platform channel for native USSD/SMS |

## Job Lifecycle

```
1. Agent polls:     GET /api/agent/queue → returns next "queued" job
2. Agent locks:     POST /api/agent/queue/{jobId}/lock → atomic lock
3. Agent executes:  Dial USSD steps sequentially via TelephonyManager
4. Agent waits:     Monitor incoming SMS for success/failure match
5. Agent reports:   POST /api/agent/queue/{jobId}/result
6. Server updates:  Transaction status → complete/failed, wallet refund if failed
```

## USSD Step Execution

Steps are pre-resolved by the server (placeholders like `{recipientNumber}`, `{amount}`, `{pin}` already replaced).

Step types:
| Type | Action |
|------|--------|
| `dial` | Dial USSD code (e.g. `*247#`) via TelephonyManager |
| `select` | Send numeric menu selection |
| `input` | Send freeform text input |
| `wait` | Pause for `waitMs` milliseconds |

Agent resolves steps via: `BackendService.resolveUssdSteps(job: job)` → returns `job.ussdSteps ?? []`

## SMS Matching (`BackendService`)

After USSD execution, agent watches incoming SMS:

1. **Success match:** `_matchSms()` converts `successSmsFormat` template (`{placeholder}` → `.*?` regex) and scans messages
2. **Failure match:** `matchFailureSms()` iterates `failureSmsTemplates[]`, tries each template in order, returns first match with its user-facing `message`
3. **Combined:** `matchIncomingSms(messages, job)` → `SmsMatchResult { sms, isSuccess, failureReason }`

Fallback: if regex fails, searches for "successful" keyword or recipient number.

## USSD Normalization (`src/lib/ussd.ts` — server-side)

- `normalizeStructuredUssdSteps(rawSteps)` — validates and normalizes step arrays
- `resolveJobUssdSteps(source)` — replaces `{recipientNumber}`, `{amount}`, `{pin}` placeholders
- `getServiceTemplateUssdSteps(source)` — reads structured steps, falls back to legacy flow
- `normalizeLegacyUssdFlow(rawFlow)` — parses legacy dash-separated format (deprecated)

## Power Control

- Admin toggles `isPoweredOn` via `POST /api/admin/devices/{deviceId}/power`
- Agent stores power state in `SharedPreferences` (`agent_is_powered_on`)
- When powered off, agent skips job polling
- Heartbeat includes `isPoweredOn` state

## Device Registration Flow

1. Admin clicks "Generate Token" → `POST /api/admin/devices/token` → returns one-time token
2. Admin shows QR code with registration token + API endpoint
3. Agent scans QR → calls `POST /api/agent/register` with token, device name, SIM provider
4. Server: validates token, creates AgentDevice doc with random `jwtSecret`, signs agent JWT
5. Agent stores JWT + deviceId in FlutterSecureStorage

## Heartbeat

Every ~30s: `POST /api/agent/heartbeat` with `{currentJob?, simProvider?, isPoweredOn}`.
Server updates `AgentDevice.lastHeartbeat`, `status` (online/busy based on currentJob).

## Backend URL Configuration

Default: `http://10.0.2.2:3000` (Android emulator → host).
Stored in SharedPreferences (`agent_backend_base_url`). `_normalizeBaseUrl()` strips trailing slashes and `/api/agent/` prefix if pasted accidentally.

## Dart Models

| Class | Maps to |
|-------|---------|
| `ExecutionJob` | Server ExecutionJob (jobId, txId, ussdSteps, failureSmsTemplates...) |
| `UssdStep` | Single USSD step (order, type, label, value, waitMs) |
| `ServiceConfig` | Service definition from server |
| `SmsFailureTemplate` | `{template, message}` pair |
| `SmsEntry` | Incoming SMS `{address, body, dateMs}` |
| `AgentConfig` | Local device config (deviceId, name, simProvider) |
| `SmsMatchResult` | Result of SMS matching (sms, isSuccess, failureReason) |
