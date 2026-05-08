# Graph Report - drecharge_admin  (2026-04-30)

## Corpus Check
- 199 files · ~183,689 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 766 nodes · 897 edges · 33 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 160 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 42|Community 42]]

## God Nodes (most connected - your core abstractions)
1. `withAdminSession()` - 41 edges
2. `connectDB()` - 37 edges
3. `apiFetch()` - 31 edges
4. `AgentForegroundService` - 28 edges
5. `getSession()` - 18 edges
6. `UssdAutomationManager` - 17 edges
7. `createNotification()` - 17 edges
8. `MainActivity` - 16 edges
9. `extractAgentSession()` - 11 edges
10. `fmt()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `generateMetadata()` --calls--> `connectDB()`  [INFERRED]
  src\app\layout.tsx → src\lib\db\mongoose.ts
- `RootLayout()` --calls--> `connectDB()`  [INFERRED]
  src\app\layout.tsx → src\lib\db\mongoose.ts
- `handleDelete()` --calls--> `deleteCategory()`  [INFERRED]
  src\app\(dashboard)\admin\categories\page.tsx → src\lib\functions.ts
- `handleConfirmTransaction()` --calls--> `initiateTransaction()`  [INFERRED]
  src\app\(dashboard)\user\services\[serviceId]\page.tsx → src\lib\functions.ts
- `handleSubmit()` --calls--> `createUserAccount()`  [INFERRED]
  src\app\(dashboard)\admin\users\page.tsx → src\lib\functions.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (85): backend_service.dart, dart:async, _ActionChip, _ActivityTab, AgentApp, _AlertBanner, AnimatedBuilder, _appendLog (+77 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (42): extractAgentSession(), generateMetadata(), RootLayout(), makeAgentSecret(), signAgentToken(), signSessionToken(), verifyAgentToken(), verifySessionToken() (+34 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (38): GET(), requireAdmin(), requireSession(), withAdminSession(), withUserSession(), POST(), GET(), POST() (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (48): handleAddFunds(), async(), save(), activateUser(), adminAddBalance(), adminChangeEmail(), adminChangeName(), adminChangePassword() (+40 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (24): addReview(), addReviewRef(), createMovie(), createMovieRef(), deleteReview(), deleteReviewRef(), getMovieById(), getMovieByIdRef() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (3): AgentConfig, AgentForegroundService, UssdExecResult

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (22): dart:convert, dart:io, AgentConfig, _authPost, BackendService, Exception, _handleResponse, jsonDecode (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (21): createNotification(), fmt(), mask(), notifyAccountActivated(), notifyAccountSuspended(), notifyBalanceRequestApproved(), notifyBalanceRequestRejected(), notifyBalanceRequestSubmitted() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (3): UssdAutomationManager, UssdSession, UssdStep

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (1): MainActivity

### Community 10 - "Community 10"
Cohesion: 0.26
Nodes (12): buildStatus(), checkSubscription(), deriveState(), fetchFromApi(), getConfiguredDomain(), getSiteDomain(), invalidateSubscriptionCache(), isDevDomain() (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (7): handleItemClick(), apiFetch(), deleteAll(), handleDelete(), markAllRead(), markRead(), openMessage()

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (4): CategoryModal(), handleDelete(), useModalEffect(), RegisterSubUserDialog()

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (9): addReview(), createMovie(), deleteReview(), getMovieById(), listMovies(), listUserReviews(), listUsers(), searchMovie() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.2
Nodes (2): CountdownRow(), useCountdown()

### Community 15 - "Community 15"
Cohesion: 0.2
Nodes (4): WalletAmount(), computeDeviceStatus(), formatCurrency(), isDeviceOnline()

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (2): insertVar(), updateStep()

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (2): UssdExecutionCallback, handleSubmit()

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): AgentConfig, ExecutionJob, ServiceConfig, SmsEntry, SmsFailureTemplate, SubscriptionInfo, UssdStep

### Community 21 - "Community 21"
Cohesion: 0.43
Nodes (6): GET(), isLocalHost(), normalizeBaseUrl(), resolveAdminDisplayUrl(), resolvePublicBaseUrl(), toEmulatorReachableUrl()

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (4): AdminGuard(), useAuth(), useProfile(), UserGuard()

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (6): AgentRoot, build, MaterialApp, package:flutter/material.dart, src/agent_app.dart, src/backend_service.dart

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (1): UssdAccessibilityService

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (2): handleDrop(), handleFiles()

### Community 29 - "Community 29"
Cohesion: 0.83
Nodes (3): handleEmailLogin(), handleQuickLogin(), signInAndRedirect()

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (2): formatAmount(), logRequestSummary()

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (2): handleConfirmTransaction(), handleFormSubmit()

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (1): GeneratedPluginRegistrant

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (1): BackgroundWakeActivity

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (1): BootReceiver

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (1): SmsReader

### Community 40 - "Community 40"
Cohesion: 0.67
Nodes (1): WatchdogReceiver

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (2): getClientDomain(), useLicenseStatus()

## Knowledge Gaps
- **119 isolated node(s):** `AgentConfig`, `UssdExecResult`, `UssdStep`, `UssdSession`, `AgentRoot` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (17 nodes): `MainActivity.kt`, `MainActivity`, `.configureFlutterEngine()`, `.handleExecuteUssdFlow()`, `.handleExecuteUssdSteps()`, `.handleGetStorageInfo()`, `.handleOpenAppInfo()`, `.handleOpenBatterySettings()`, `.handleOpenUrl()`, `.handleReadRecentSms()`, `.handleReleaseWakeLock()`, `.handleSyncBackgroundConfig()`, `.handleWakeScreen()`, `.onCreate()`, `.onDestroy()`, `.onResume()`, `.startAgentService()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (11 nodes): `CountdownRow()`, `Dot()`, `ErrorCard()`, `fmtDate()`, `formatCountdown()`, `LoadingSkeleton()`, `NotRegisteredCard()`, `relTime()`, `resolveLogoUrl()`, `useCountdown()`, `LicenseCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (10 nodes): `addStep()`, `deleteStep()`, `FieldLabel()`, `insertVar()`, `onDragOver()`, `onDragStart()`, `onDrop()`, `Section()`, `updateStep()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (8 nodes): `UssdExecutionCallback.kt`, `UssdExecutionCallback`, `.onError()`, `.onSuccess()`, `page.tsx`, `handleClose()`, `handleCopy()`, `handleSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (6 nodes): `UssdAccessibilityService.kt`, `UssdAccessibilityService`, `.onAccessibilityEvent()`, `.onDestroy()`, `.onInterrupt()`, `.onServiceConnected()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (5 nodes): `handleClear()`, `handleDrop()`, `handleFiles()`, `uploadToImgBB()`, `ImageUpload.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (4 nodes): `exportCsv()`, `formatAmount()`, `logRequestSummary()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (4 nodes): `handleConfirmTransaction()`, `handleFormSubmit()`, `page.tsx`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (3 nodes): `GeneratedPluginRegistrant.java`, `GeneratedPluginRegistrant`, `.registerWith()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (3 nodes): `BackgroundWakeActivity.kt`, `BackgroundWakeActivity`, `.onCreate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (3 nodes): `BootReceiver.kt`, `BootReceiver`, `.onReceive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (3 nodes): `SmsReader.kt`, `SmsReader`, `.readRecentSms()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (3 nodes): `WatchdogReceiver.kt`, `WatchdogReceiver`, `.onReceive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (3 nodes): `getClientDomain()`, `useLicenseStatus()`, `useLicenseStatus.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `connectDB()` connect `Community 1` to `Community 2`, `Community 10`, `Community 21`, `Community 7`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `withAdminSession()` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `createNotification()` connect `Community 7` to `Community 1`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 38 inferred relationships involving `withAdminSession()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`withAdminSession()` has 38 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `connectDB()` (e.g. with `generateMetadata()` and `RootLayout()`) actually correct?**
  _`connectDB()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `getSession()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`getSession()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AgentConfig`, `UssdExecResult`, `UssdStep` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._