# Database Context
<!-- WHEN TO LOAD: Adding/modifying models, writing queries, changing schemas, debugging data issues. -->

## Connection

`src/lib/db/mongoose.ts` — singleton connection via `connectDB()`. Uses `global._mongooseConn` to survive HMR. **Always call `await connectDB()` before any model operation.**

```
MONGODB_URI from .env.local → mongoose.connect(URI, { bufferCommands: false })
```

## ID Strategy

**All models use string `_id`** (not ObjectId). Generated via `nanoid()` at creation time in API routes. Models define `_id: { type: String, required: true }`.

---

## Models (`src/lib/db/models/`)

### User
| Field | Type | Notes |
|-------|------|-------|
| _id | String | nanoid |
| email | String | unique, lowercase, trimmed |
| displayName | String | |
| role | Enum | `user \| admin \| super_admin \| support_admin \| agent` |
| walletBalance | Number | default 0 |
| walletLocked | Boolean | default false |
| status | Enum | `active \| suspended` |
| passwordHash | String | bcrypt, 12 rounds |
| phoneNumber | String? | |
| pin | String? | |
| createdAt | Date | auto (timestamps) |
| lastLoginAt | Date | |

**Indexes:** `email`, `role`, `status`

### Transaction
| Field | Type | Notes |
|-------|------|-------|
| _id | String | |
| userId | String | indexed |
| type | Enum | `send \| topup \| deduct \| refund` |
| serviceId | String? | |
| recipientNumber | String? | |
| amount | Number | |
| fee | Number | default 0 |
| status | Enum | `pending \| processing \| waiting \| complete \| failed` |
| note | String? | |
| failureReason | String? | user-facing reason from matched SMS template |
| adminId | String? | |
| createdAt | Date | auto |
| completedAt | Date? | |

**Indexes:** `status`, `createdAt desc`, `(userId, createdAt desc)`

### Service
| Field | Type | Notes |
|-------|------|-------|
| _id | String | |
| name | String | |
| icon | String | URL |
| description | String | |
| isActive | Boolean | |
| categoryId | String? | FK to ServiceCategory |
| ussdSteps | Array | `{order, type, label, value, waitMs?}` — **source of truth** |
| pin | String | SIM PIN for USSD |
| simSlot | Number | 1 or 2 |
| successSmsFormat | String | SMS template with `{placeholders}` |
| failureSmsTemplates | Array | `{template, message}[]` — multi-failure patterns |
| smsTimeout | Number | seconds to wait for SMS |
| updatedAt | Date | auto |
| updatedBy | String | admin UID |

**Indexes:** `isActive`, `categoryId`
**Step types:** `dial \| select \| input \| wait`
**Placeholders in values:** `{recipientNumber}`, `{amount}`, `{pin}`

### ExecutionJob
| Field | Type | Notes |
|-------|------|-------|
| _id | String | |
| txId | String | FK to Transaction |
| userId | String | |
| serviceId | String | |
| recipientNumber | String | |
| amount | Number | |
| ussdSteps | Array? | Resolved steps — placeholders already replaced |
| simSlot | Number? | |
| smsTimeout | Number? | |
| successSmsFormat | String? | |
| failureSmsTemplates | Array? | `{template, message}[]` |
| status | Enum | `queued \| processing \| waiting \| done \| failed \| cancelled` |
| locked | Boolean | atomic lock for device |
| lockedAt | Date? | |
| lockedByDevice | String? | |
| attempt | Number | |
| rawSms | String? | actual SMS received |
| parsedResult | Mixed? | `{success, txRef?, amount?, reason?}` |
| ussdStepsExecuted | Array? | execution trace |
| queuedAt | Date | auto (timestamps createdAt) |
| completedAt | Date? | |

**Indexes:** `(status, createdAt)`, `(locked, status, lockedAt)`

### AgentDevice
| Field | Type | Notes |
|-------|------|-------|
| _id | String | deviceId |
| name | String | |
| status | Enum | `online \| offline \| busy \| revoked \| paused` |
| isPoweredOn | Boolean | power toggle from admin |
| simProvider | String | |
| authUid | String | unique |
| authEmail | String | |
| jwtSecret | String | **per-device** JWT signing secret |
| lastHeartbeat | Date | |
| currentJob | String? | |
| appVersion | String? | |
| deviceFingerprint | String? | |
| registeredAt | Date | |
| revokedAt/revokedBy | Date?/String? | |

### ServiceCategory
| Field | Type |
|-------|------|
| _id | String |
| name | String |
| logo | String |
| order | Number? |
| createdAt | Date |

### BalanceRequest
| Field | Type | Notes |
|-------|------|-------|
| _id | String | |
| userId | String | indexed |
| amount | Number | |
| status | Enum | `pending \| approved \| rejected` |
| medium | String? | |
| note | String? | |
| adminNote | String? | |
| approvedBy | String? | |
| requestedAt | Date | auto (timestamps createdAt) |
| processedAt | Date? | |

### Notification
| Field | Type | Notes |
|-------|------|-------|
| _id | String | `nanoid(20)` auto-generated |
| recipientUid | String | user UID or `"admin"` for broadcast |
| type | String | event type key |
| title | String | |
| body | String | |
| isRead | Boolean | |
| link | String? | relative URL |
| createdAt | Date | |

**Index:** `(recipientUid, isRead, createdAt desc)`

### AgentRegistrationToken
| Field | Type | Notes |
|-------|------|-------|
| _id | String | |
| tokenHash | String | hashed registration token |
| createdBy | String | admin UID |
| expiresAt | Date | TTL index (auto-delete) |
| usedAt | Date? | |
| usedByDeviceId | String? | |
| authUid/authEmail | String? | |

### AuditLog
| Field | Type | Notes |
|-------|------|-------|
| uid | String? | |
| action | String | |
| entityId | String? | |
| severity | Enum | `info \| warn \| error \| critical` |
| ip, userAgent, deviceType, browser, os | String | defaults to `"server"` |
| location | Mixed | |
| meta | Mixed | |
| timestamp | Date | |

**Indexes:** `timestamp desc`, `action`, `severity`, `uid`

---

## Relationships

```
User (1) ──▶ (N) Transaction
User (1) ──▶ (N) BalanceRequest
User (1) ──▶ (N) Notification
ServiceCategory (1) ──▶ (N) Service
Service (1) ──▶ (N) ExecutionJob (via serviceId)
Transaction (1) ──▶ (1) ExecutionJob (via txId)
AgentDevice (1) ──▶ (N) ExecutionJob (via lockedByDevice)
```

No Mongoose `ref`/`populate` used — all joins are manual in API routes.

## Helper: `writeLog()` (`src/lib/db/audit.ts`)
Creates AuditLog entries. Never throws — logs errors to console silently.
