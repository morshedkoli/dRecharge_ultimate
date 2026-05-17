// dRecharge Agent — redesigned UI/UX
// Navigation:
//   SetupScreen  → first-run wizard (permissions + backend + register)
//   HomeScreen   → clean status dashboard (the main screen)
//   SettingsPage → backend URL, permissions, device registration / reset

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:device_info_plus/device_info_plus.dart';

import 'backend_service.dart';
import 'models.dart';
import 'native_bridge.dart';

// ─────────────────────────────────────────────────────────────────────────────
// App root – routes + theme
// ─────────────────────────────────────────────────────────────────────────────

class AgentApp extends StatelessWidget {
  const AgentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'dRecharge Agent',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1B6B4D), // deep green
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF1B6B4D),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      home: const _AppShell(),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell – bootstraps and decides which root screen to show
// ─────────────────────────────────────────────────────────────────────────────

class _AppShell extends StatefulWidget {
  const _AppShell();

  @override
  State<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<_AppShell> with WidgetsBindingObserver {
  final _nativeBridge = NativeBridge();
  final _backendUrlController = TextEditingController();
  final _tokenController = TextEditingController();
  final _deviceNameController = TextEditingController();

  AgentConfig? _config;
  bool _backendConfigured = false;
  bool _loading = true;
  bool _registering = false;
  bool _savingBackendUrl = false;
  bool _processing = false;
  bool _phonePermissionGranted = false;
  bool _smsPermissionGranted = false;
  bool _notificationPermissionGranted = false;
  bool _accessibilityEnabled = false;
  bool _exactAlarmGranted = false;
  bool _batteryOptGranted = false;
  bool _isPoweredOn = true; // master power switch
  String _status = 'Idle';
  String? _currentJobId;
  String? _lastError;
  String? _lastUssdResponse; // last USSD response text from device
  String? _lastJobOutcome; // 'success' | 'failed' | 'waiting' | 'unrecognized'
  String? _lastServiceName; // service name of the last executed job
  final List<String> _logs = <String>[];
  SubscriptionInfo? _subscriptionInfo;
  Timer? _pollTimer;
  Timer? _heartbeatTimer;
  Timer? _deviceInfoTimer;
  Timer? _subscriptionTimer;
  Timer? _smsUploadTimer;

  /// Unix-ms watermark: only SMS received AFTER this point will be uploaded.
  /// Initialised to app-start time so we never re-upload old messages.
  int _lastSmsUploadMs = DateTime.now().millisecondsSinceEpoch;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrap();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_processing) {
      _refreshCapabilities();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    _heartbeatTimer?.cancel();
    _deviceInfoTimer?.cancel();
    _subscriptionTimer?.cancel();
    _smsUploadTimer?.cancel();
    _backendUrlController.dispose();
    _tokenController.dispose();
    _deviceNameController.dispose();
    super.dispose();
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────

  Future<void> _bootstrap() async {
    try {
      _backendUrlController.text = await BackendService.getConfiguredBaseUrl();
      final storedBaseUrl = await BackendService.hasStoredBaseUrl();
      final savedConfig = await BackendService.loadConfig();
      final authenticated = await BackendService.isAuthenticated;
      _isPoweredOn = await BackendService.loadPowerState();
      // Pre-populate device name field with auto-detected name
      if (_deviceNameController.text.isEmpty) {
        _deviceNameController.text = await _getDeviceName();
      }

      _backendConfigured = storedBaseUrl;

      if (savedConfig != null && authenticated) {
        if (!storedBaseUrl) {
          await BackendService.saveBaseUrl(BackendService.currentBaseUrl);
          _backendConfigured = true;
        }
        _config = savedConfig;
        await _syncBackgroundServiceConfig();
        _startLoops();
      } else if (savedConfig != null && !authenticated) {
        await BackendService.clearConfig();
        await _nativeBridge.clearBackgroundConfig();
      }

      await _refreshCapabilities();
      unawaited(_refreshSubscription());
    } catch (error) {
      _lastError = error.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _syncBackgroundServiceConfig() async {
    final token = await BackendService.getStoredJwtToken();
    await _nativeBridge.syncBackgroundConfig(
      baseUrl: BackendService.currentBaseUrl,
      jwtToken: token,
      isPoweredOn: _isPoweredOn,
      deviceName: _config?.name,
      simProvider: _config?.simProvider,
    );
    await _nativeBridge.startBackgroundService();
  }

  Future<void> _refreshSubscription() async {
    final info = await BackendService.fetchSubscriptionStatus();
    if (!mounted) return;
    setState(() => _subscriptionInfo = info);
  }

  // ── Capabilities ─────────────────────────────────────────────────────────

  Future<void> _refreshCapabilities() async {
    final phoneStatus = await Permission.phone.status;
    final smsStatus = await Permission.sms.status;
    final notificationStatus = await Permission.notification.status;
    final accessibilityEnabled = await _nativeBridge.isAccessibilityEnabled();
    final exactAlarm = await _nativeBridge.isExactAlarmGranted();
    final batteryOpt = await Permission.ignoreBatteryOptimizations.isGranted;
    if (!mounted) return;
    setState(() {
      _phonePermissionGranted = phoneStatus.isGranted;
      _smsPermissionGranted = smsStatus.isGranted;
      _notificationPermissionGranted = notificationStatus.isGranted;
      _accessibilityEnabled = accessibilityEnabled;
      _exactAlarmGranted = exactAlarm;
      _batteryOptGranted = batteryOpt;
    });
  }

  Future<void> _requestPermissions() async {
    await <Permission>[
      Permission.phone,
      Permission.sms,
      Permission.notification,
    ].request();
    if (!await Permission.ignoreBatteryOptimizations.isGranted) {
      await Permission.ignoreBatteryOptimizations.request();
    }
    if (!await _nativeBridge.isExactAlarmGranted()) {
      await _nativeBridge.openExactAlarmSettings();
    }
    await _refreshCapabilities();
  }

  bool get _allPermissionsOk =>
      _phonePermissionGranted &&
      _smsPermissionGranted &&
      _notificationPermissionGranted &&
      _accessibilityEnabled &&
      _exactAlarmGranted &&
      _batteryOptGranted;

  // ── Backend URL ──────────────────────────────────────────────────────────

  Future<void> _saveBackendUrl() async {
    final rawUrl = _backendUrlController.text.trim();
    final parsed = Uri.tryParse(rawUrl);
    final isValid =
        parsed != null &&
        parsed.hasScheme &&
        (parsed.scheme == 'http' || parsed.scheme == 'https') &&
        parsed.host.isNotEmpty;

    if (!isValid) {
      setState(() => _lastError = 'Backend URL must be a valid http(s) URL.');
      return;
    }

    final wasRegistered = _config != null;
    setState(() {
      _savingBackendUrl = true;
      _lastError = null;
    });

    try {
      final bootstrap = await BackendService.testBaseUrl(rawUrl);
      if (bootstrap['success'] != true) {
        throw Exception('Endpoint validation failed.');
      }

      final resolvedBaseUrl = (bootstrap['baseUrl'] as String?)?.trim();
      await BackendService.saveBaseUrl(
        resolvedBaseUrl != null && resolvedBaseUrl.isNotEmpty
            ? resolvedBaseUrl
            : rawUrl,
      );

      if (wasRegistered) {
        _pollTimer?.cancel();
        _heartbeatTimer?.cancel();
        await BackendService.clearConfig();
        await _nativeBridge.clearBackgroundConfig();
      }

      if (!mounted) return;

      // Only clear token when re-configuring an already-registered device
      // (token from old backend is invalid). For fresh setup keep it.
      if (wasRegistered) _tokenController.clear();

      setState(() {
        _backendConfigured = true;
        _config = null;
        _currentJobId = null;
        _status = wasRegistered
            ? 'Backend updated — register again'
            : 'Endpoint verified';
        if (wasRegistered) {
          _lastError =
              'Backend changed. Re-register this device on the new server.';
        }
      });
      _appendLog('Backend URL set to ${BackendService.currentBaseUrl}.');
      await _syncBackgroundServiceConfig();
    } catch (error) {
      if (!mounted) return;
      setState(() => _lastError = 'Failed to save backend URL: $error');
    } finally {
      if (mounted) setState(() => _savingBackendUrl = false);
    }
  }

  Future<void> _resetBackendUrl() async {
    final wasRegistered = _config != null;
    setState(() {
      _savingBackendUrl = true;
      _lastError = null;
    });
    try {
      await BackendService.resetBaseUrl();
      if (wasRegistered) {
        _pollTimer?.cancel();
        _heartbeatTimer?.cancel();
        await BackendService.clearConfig();
        await _nativeBridge.clearBackgroundConfig();
      }
      if (!mounted) return;
      _backendUrlController.text = BackendService.currentBaseUrl;
      _tokenController.clear();
      setState(() {
        _backendConfigured = false;
        _config = null;
        _currentJobId = null;
        _status = 'Configure backend endpoint';
        _lastError = wasRegistered
            ? 'Backend reset. Re-register to continue.'
            : null;
      });
      _appendLog('Backend URL reset.');
    } catch (error) {
      if (!mounted) return;
      setState(() => _lastError = 'Failed to reset backend URL: $error');
    } finally {
      if (mounted) setState(() => _savingBackendUrl = false);
    }
  }

  // ── Registration ─────────────────────────────────────────────────────────

  Future<String> _getDeviceName() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      final androidInfo = await deviceInfo.androidInfo;
      final brand = androidInfo.brand.trim();
      final model = androidInfo.model.trim();
      // Many phones include the brand in the model (e.g. brand="Infinix", model="Infinix X6528B")
      // Avoid double: "Infinix Infinix X6528B" → just use model
      if (model.toLowerCase().startsWith(brand.toLowerCase())) {
        return model;
      }
      return '$brand $model'.trim();
    } catch (_) {
      return 'Android Device';
    }
  }

  Future<void> _registerDevice() async {
    if (_registering) return;
    if (_tokenController.text.trim().isEmpty) {
      setState(() => _lastError = 'Token is required.');
      return;
    }
    setState(() {
      _registering = true;
      _lastError = null;
      _status = 'Registering device';
    });
    try {
      final typed = _deviceNameController.text.trim();
      final deviceName = typed.isNotEmpty ? typed : await _getDeviceName();
      const simProvider = 'Default';

      final deviceId = await BackendService.registerDevice(
        registrationToken: _tokenController.text.trim(),
        deviceName: deviceName,
        simProvider: simProvider,
      );
      if (!mounted) return;
      _config = AgentConfig(
        deviceId: deviceId,
        name: deviceName,
        simProvider: simProvider,
      );
      setState(() {
        _tokenController.clear();
        _status = 'Device registered';
      });
      await _syncBackgroundServiceConfig();
      _appendLog('Device $deviceId registered.');
      _startLoops();
      await _refreshCapabilities();
      await _sendHeartbeat();
      if (!mounted) return;

      // SettingsPage is pushed as a separate route with a snapshot of the
      // current config. After registration succeeds, close that stale route so
      // the user returns to the refreshed registered state instead of seeing
      // the old "Register Device" prompt again.
      final navigator = Navigator.of(context);
      if (navigator.canPop()) {
        navigator.pop();
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _lastError = error.toString();
        _status = 'Registration failed';
      });
    } finally {
      if (mounted) setState(() => _registering = false);
    }
  }

  // ── QR Scanner ───────────────────────────────────────────────────────────

  /// Scans a QR code produced by the admin panel.
  ///
  /// If the QR payload contains both a server URL **and** a registration token
  /// (i.e. `{"url": "...", "token": "DRA-..."}`) the device is automatically
  /// registered in one step — no manual token entry required.
  Future<void> _scanQrCode() async {
    final scanned = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const QrScanPage()),
    );
    if (scanned == null || !mounted) return;

    String? resolvedUrl;
    String? resolvedToken;

    try {
      final decoded = jsonDecode(scanned) as Map<String, dynamic>;
      resolvedUrl = (decoded['url'] as String?)?.trim();
      resolvedToken = (decoded['token'] as String?)?.trim();
    } catch (_) {
      final trimmed = scanned.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        resolvedUrl = trimmed;
      }
    }

    if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
      _backendUrlController.text = resolvedUrl;
    }
    if (resolvedToken != null && resolvedToken.isNotEmpty) {
      _tokenController.text = resolvedToken;
    }

    // Save / validate the backend URL first.
    if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
      await _saveBackendUrl();
    }

    // ── One-scan registration ────────────────────────────────────────────
    // If the QR also carried a token and the backend URL was accepted,
    // automatically register the device without any further user input.
    if (!mounted) return;
    if (resolvedToken != null &&
        resolvedToken.isNotEmpty &&
        _backendConfigured &&
        _config == null) {
      // Ensure token controller is populated (may have been cleared by
      // _saveBackendUrl if backend changed).
      if (_tokenController.text.trim().isEmpty) {
        _tokenController.text = resolvedToken;
      }
      // Show a brief notice so the user knows registration is happening.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('QR scanned — registering device automatically…'),
          duration: Duration(seconds: 3),
        ),
      );
      await _registerDevice();
    }
  }

  // ── Worker loops ─────────────────────────────────────────────────────────

  void _startLoops() {
    _pollTimer?.cancel();
    _heartbeatTimer?.cancel();
    _deviceInfoTimer?.cancel();
    _subscriptionTimer?.cancel();
    _smsUploadTimer?.cancel();

    _pollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_runQueueTick()),
    );
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => unawaited(_sendHeartbeat()),
    );
    _deviceInfoTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => unawaited(BackendService.sendDeviceInfo()),
    );
    _subscriptionTimer = Timer.periodic(
      const Duration(hours: 1),
      (_) => unawaited(_refreshSubscription()),
    );
    // Upload any new SMS to admin inbox every 60 s
    _smsUploadTimer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => unawaited(_uploadRecentSms()),
    );

    unawaited(_runQueueTick());
    unawaited(_sendHeartbeat());
    unawaited(BackendService.sendDeviceInfo());
    // First upload runs after a short delay so the app is fully ready
    Future.delayed(
      const Duration(seconds: 10),
      () => unawaited(_uploadRecentSms()),
    );
  }

  /// Reads all SMS messages received since [_lastSmsUploadMs] and forwards
  /// them to the admin SMS inbox. The watermark is advanced only on success
  /// so that a transient network error does not silently drop messages.
  Future<void> _uploadRecentSms() async {
    if (_config == null) return; // not registered yet
    try {
      final since = _lastSmsUploadMs;
      final messages = await _nativeBridge.readRecentSms(
        sinceMs: since,
        maxMessages: 200,
      );
      if (messages.isEmpty) return;

      // Advance the watermark to the newest message's timestamp + 1 ms
      // BEFORE the upload so that even if upload fails, we don't re-fetch
      // the same batch indefinitely on every tick. If the server rejects
      // the batch we still drop it (non-critical inbox feature).
      final newest = messages
          .map((m) => m.dateMs)
          .reduce((a, b) => a > b ? a : b);
      _lastSmsUploadMs = newest + 1;

      final saved = await BackendService.sendSmsToInbox(messages);
      if (saved > 0) {
        _appendLog('SMS inbox: uploaded $saved message(s).');
      }
    } catch (e) {
      debugPrint('[AgentApp] _uploadRecentSms error: $e');
    }
  }

  Future<void> _sendHeartbeat({bool isPowerToggle = false}) async {
    if (_config == null) return;
    try {
      final serverPowerState = await BackendService.sendHeartbeat(
        currentJob: _currentJobId,
        simProvider: _config?.simProvider,
        name: _config?.name,
        isPoweredOn: _isPoweredOn,
        powerToggle: isPowerToggle,
      );

      if (serverPowerState != null && serverPowerState != _isPoweredOn) {
        if (!mounted) return;
        setState(() {
          _isPoweredOn = serverPowerState;
          _status = serverPowerState ? 'Idle' : 'Paused';
        });
        await BackendService.savePowerState(serverPowerState);
        await _syncBackgroundServiceConfig();
        _appendLog(
          serverPowerState
              ? 'Agent powered ON remotely.'
              : 'Agent powered OFF remotely.',
        );
      }
    } catch (error) {
      _appendLog('Heartbeat failed: $error');
    }
  }

  Future<void> _runQueueTick() async {
    final config = _config;
    if (config == null || _processing) return;

    // Power is off — do nothing (heartbeat will still run to report status)
    if (!_isPoweredOn) {
      if (mounted) setState(() => _status = 'Paused');
      return;
    }

    // Subscription gate — block if not active; "unknown" is grace (API down)
    final sub = _subscriptionInfo;
    if (sub != null && sub.state != 'active' && sub.state != 'unknown') {
      if (mounted) {
        setState(() => _status = 'Suspended — subscription ${sub.state}');
      }
      return;
    }

    if (!_phonePermissionGranted ||
        !_smsPermissionGranted ||
        !_notificationPermissionGranted ||
        !_accessibilityEnabled ||
        !_exactAlarmGranted ||
        !_batteryOptGranted) {
      if (mounted) setState(() => _status = 'Waiting for startup readiness');
      return;
    }

    _processing = true;
    try {
      if (mounted) setState(() => _status = 'Checking queue');
      final job = await BackendService.fetchNextQueuedJob();
      if (job == null) {
        if (mounted) setState(() => _status = 'Idle');
        return;
      }

      final acquired = await BackendService.acquireJobLock(job.jobId);
      if (!acquired) return;

      // Re-fetch the job after locking to get the freshest state.
      // All execution parameters (ussdSteps, simSlot, smsTimeout, SMS formats)
      // are embedded in the job — no separate service API call needed.
      final liveJob = await BackendService.fetchJob(job.jobId) ?? job;
      if (!mounted) return;
      setState(() {
        _currentJobId = liveJob.jobId;
        _status =
            'Processing ${liveJob.serviceName.isNotEmpty ? liveJob.serviceName : 'Unknown Service'}';
        _lastError = null;
      });
      _appendLog(
        '${liveJob.serviceName} → ${liveJob.recipientNumber} · ৳${liveJob.amount}',
      );
      await _sendHeartbeat();

      // ── Resolve execution steps ─────────────────────────────────────────────
      // All jobs carry ussdSteps — placeholders already resolved by the server.
      var steps = BackendService.resolveUssdSteps(job: liveJob);
      if (steps.isEmpty) {
        final serviceConfig = await BackendService.fetchService(
          liveJob.serviceId,
        );
        if (serviceConfig != null && serviceConfig.ussdSteps.isNotEmpty) {
          steps = serviceConfig.ussdSteps;
        }
      }
      if (steps.isEmpty) {
        await _reportFailure(
          job: liveJob,
          reason: 'Job has no USSD steps or flow to execute.',
          stepsExecuted: const <Map<String, dynamic>>[],
          rawSms: '',
        );
        return;
      }

      // Wake screen so USSD dialog is visible (no-op if screen already on)
      try {
        await _nativeBridge.wakeScreen();
      } catch (_) {}

      List<Map<String, dynamic>> stepsExecuted;
      try {
        // All jobs use structured steps — execute via typed step list.
        stepsExecuted = await _nativeBridge.executeUssdSteps(
          steps: steps,
          simSlot: liveJob.simSlot,
        );
      } catch (error) {
        await _nativeBridge.releaseWakeLock().catchError((_) {});
        await _reportFailure(
          job: liveJob,
          reason: 'USSD execution failed: $error',
          stepsExecuted: const <Map<String, dynamic>>[],
          rawSms: '',
        );
        return;
      }

      // ── Extract USSD Response Text ─────────────────────────────────────────
      final int ussdCompletedMs = DateTime.now().millisecondsSinceEpoch;
      final Map<String, dynamic>? ussdResponseStep = stepsExecuted
          .cast<Map<String, dynamic>?>()
          .lastWhere(
            (s) => s != null && s['type'] == 'response',
            orElse: () => null,
          );
      final String ussdResponseText =
          ussdResponseStep?['value'] as String? ?? '';

      // ── Step 1: Try matching the USSD dialog text immediately ──────────────
      // Works for services that embed success/failure in the USSD response dialog.
      SmsMatchResult? matchResult;
      if (ussdResponseText.isNotEmpty) {
        final mockSms = SmsEntry(
          address: 'USSD',
          body: ussdResponseText,
          dateMs: ussdCompletedMs,
        );
        final r = BackendService.matchIncomingSms(
          messages: [mockSms],
          job: liveJob,
        );
        if (r.hasMatch) matchResult = r;
      }

      // ── Step 2: Wait for real SMS if USSD text didn't match ────────────────
      // Required for services like bKash where confirmation comes via SMS
      // (e.g. "Cash In Tk 50.00 to 01812345678 successful. TrxID DEH1AUO01L…")
      // rather than in the USSD dialog itself.
      String finalRawSms = ussdResponseText;
      String finalRawSmsSource = 'ussd';
      String? finalSmsSender;
      int? finalSmsReceivedAt;

      // Poll for SMS whenever: a template is configured (server or job level),
      // OR smsTimeout > 0 (service is declared as SMS-only, e.g. bKash).
      // The second condition covers the race where the agent APK was built before
      // the template was added — the server now returns the resolved format, but
      // an older APK may receive an empty string if the job was queued earlier.
      final bool hasSmsTemplate = (liveJob.successSmsFormat ?? '').isNotEmpty ||
          liveJob.failureSmsTemplates.isNotEmpty ||
          liveJob.smsTimeout > 0;

      if (matchResult == null && hasSmsTemplate) {
        final int timeoutMs =
            (liveJob.smsTimeout * 1000).clamp(5000, 120000);
        final int pollEnd = ussdCompletedMs + timeoutMs;

        if (mounted) {
          setState(
            () => _status = 'Waiting for SMS… (${liveJob.smsTimeout}s)',
          );
        }
        _appendLog(
          '⏳ ${liveJob.serviceName} — waiting for SMS (${liveJob.smsTimeout}s)',
        );

        while (DateTime.now().millisecondsSinceEpoch < pollEnd) {
          await Future.delayed(const Duration(seconds: 2));

          try {
            // Read SMS received around the time USSD was sent (5s buffer)
            final recentSms = await _nativeBridge.readRecentSms(
              sinceMs: ussdCompletedMs - 5000,
              maxMessages: 20,
            );

            final r = BackendService.matchIncomingSms(
              messages: recentSms,
              job: liveJob,
            );

            if (r.hasMatch && r.sms != null) {
              matchResult = r;
              finalRawSms = r.sms!.body;
              finalRawSmsSource = 'sms';
              finalSmsSender = r.sms!.address;
              finalSmsReceivedAt = r.sms!.dateMs;
              _appendLog(
                r.isSuccess
                    ? '✓ SMS matched — success'
                    : '✗ SMS matched — failure (${r.failureReason ?? ""})',
              );
              break;
            }
          } catch (e) {
            _appendLog('SMS poll error: $e');
          }
        }

        if (matchResult == null) {
          _appendLog(
            '⏱ SMS timeout — submitting USSD response for manual review',
          );
        }
      }

      // ── Step 3: Report result to server ────────────────────────────────────
      final bool isSuccess = matchResult?.isSuccess ?? false;
      final Map<String, dynamic> finalParsedResult =
          (matchResult != null && matchResult.hasMatch)
          ? <String, dynamic>{
              'success': matchResult.isSuccess,
              if (matchResult.failureReason != null)
                'reason': matchResult.failureReason,
            }
          : <String, dynamic>{
              'success': false,
              'reason': ussdResponseText.isNotEmpty
                  ? 'No matching SMS or USSD response received.'
                  : 'No USSD response and no SMS received.',
            };

      await BackendService.reportJobResult(
        jobId: liveJob.jobId,
        txId: liveJob.txId,
        serviceName: liveJob.serviceName,
        recipientNumber: liveJob.recipientNumber,
        amount: liveJob.amount,
        rawSms: finalRawSms,
        isSuccess: isSuccess,
        parsedResult: finalParsedResult,
        ussdStepsExecuted: stepsExecuted,
        rawSmsSource: finalRawSmsSource,
        smsSenderNumber: finalSmsSender,
        smsReceivedAt: finalSmsReceivedAt,
      );
      await _nativeBridge.releaseWakeLock().catchError((_) {});

      // ── Store last response for dashboard preview ──────────────────────────
      final String outcome = matchResult != null && matchResult.hasMatch
          ? (matchResult.isSuccess ? 'success' : 'failed')
          : (ussdResponseText.isNotEmpty ? 'unrecognized' : 'failed');
      if (mounted) {
        setState(() {
          _lastUssdResponse =
              ussdResponseText.isNotEmpty ? ussdResponseText : null;
          _lastJobOutcome = outcome;
          _lastServiceName =
              liveJob.serviceName.isNotEmpty ? liveJob.serviceName : null;
        });
      }

      if (matchResult != null && matchResult.hasMatch) {
        _appendLog(
          matchResult.isSuccess
              ? '✓ ${liveJob.serviceName} → ${liveJob.recipientNumber} · ৳${liveJob.amount}'
              : '✗ ${liveJob.serviceName} → ${liveJob.recipientNumber} · ৳${liveJob.amount}',
        );
      } else {
        _appendLog(
          '⏳ ${liveJob.serviceName} → ${liveJob.recipientNumber} · ৳${liveJob.amount} — sent for review',
        );
      }

      if (mounted) setState(() => _status = 'Last job reported');
    } catch (error) {
      _appendLog('Queue tick failed: $error');
      final errorStr = error.toString().toLowerCase();
      if (errorStr.contains('unauthenticated') ||
          errorStr.contains('revoked') ||
          errorStr.contains('unauthorized')) {
        _appendLog('Auth error — resetting device...');
        _pollTimer?.cancel();
        _heartbeatTimer?.cancel();
        await BackendService.clearConfig();
        await _nativeBridge.clearBackgroundConfig();
        if (mounted) {
          setState(() {
            _config = null;
            _currentJobId = null;
            _status = 'Device access revoked';
            _lastError = 'Your device access was revoked. Please re-register.';
          });
        }
        return;
      }
      if (mounted) {
        setState(() {
          _lastError = error.toString();
          _status = 'Error';
        });
      }
    } finally {
      _processing = false;
      _currentJobId = null;
      await _sendHeartbeat();
      if (mounted && _status.startsWith('Processing')) {
        setState(() => _status = 'Idle');
      }
    }
  }

  Future<void> _reportFailure({
    required ExecutionJob job,
    required String reason,
    required List<Map<String, dynamic>> stepsExecuted,
    required String rawSms,
  }) async {
    await BackendService.reportJobResult(
      jobId: job.jobId,
      txId: job.txId,
      serviceName: job.serviceName,
      recipientNumber: job.recipientNumber,
      amount: job.amount,
      rawSms: rawSms,
      isSuccess: false,
      parsedResult: <String, dynamic>{'success': false, 'reason': reason},
      ussdStepsExecuted: stepsExecuted,
      rawSmsSource: 'ussd',
    );
    _appendLog(
      '✗ ${job.serviceName} → ${job.recipientNumber} · ৳${job.amount}',
    );
  }

  void _appendLog(String message) {
    final timestamp = TimeOfDay.now().format(context);
    if (!mounted) return;
    setState(() {
      _logs.insert(0, '[$timestamp] $message');
      if (_logs.length > 60) _logs.removeRange(60, _logs.length);
    });
  }

  Future<void> _resetDevice() async {
    await BackendService.clearConfig();
    await _nativeBridge.clearBackgroundConfig();
    if (!mounted) return;
    setState(() {
      _config = null;
      _currentJobId = null;
      _status = 'Idle';
      _lastError = null;
      _isPoweredOn = true;
      _logs.clear();
    });
    await _syncBackgroundServiceConfig();
  }

  // ── Power Toggle ──────────────────────────────────────────────────────────────

  Future<void> _togglePower() async {
    final newValue = !_isPoweredOn;
    setState(() {
      _isPoweredOn = newValue;
      _status = newValue ? 'Idle' : 'Paused';
    });
    await BackendService.savePowerState(newValue);
    await _syncBackgroundServiceConfig();
    _appendLog(newValue ? 'Agent powered ON.' : 'Agent powered OFF.');
    // Immediately notify server with new state and explicit flag
    await _sendHeartbeat(isPowerToggle: true);
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Startup readiness: keep operators in guided setup until the device can
    // reliably run background USSD jobs and is registered to a backend.
    final bool setupComplete =
        _backendConfigured && _config != null && _allPermissionsOk;
    if (!setupComplete) {
      return SetupScreen(
        backendUrlController: _backendUrlController,
        tokenController: _tokenController,
        deviceNameController: _deviceNameController,
        saving: _savingBackendUrl,
        registering: _registering,
        phoneGranted: _phonePermissionGranted,
        smsGranted: _smsPermissionGranted,
        notificationGranted: _notificationPermissionGranted,
        accessibilityEnabled: _accessibilityEnabled,
        exactAlarmGranted: _exactAlarmGranted,
        batteryOptGranted: _batteryOptGranted,
        onSaveUrl: _saveBackendUrl,
        onScanQr: _scanQrCode,
        onRequestPermissions: _requestPermissions,
        onOpenAccessibility: _nativeBridge.openAccessibilitySettings,
        onOpenExactAlarmSettings: _nativeBridge.openExactAlarmSettings,
        onRegister: _registerDevice,
        lastError: _lastError,
        backendConfigured: _backendConfigured,
        registered: _config != null,
        deviceName: _config?.name,
        deviceId: _config?.deviceId,
      );
    }

    // Main home screen
    return HomeScreen(
      config: _config,
      status: _status,
      currentJobId: _currentJobId,
      lastError: _lastError,
      processing: _processing,
      logs: _logs,
      phoneGranted: _phonePermissionGranted,
      smsGranted: _smsPermissionGranted,
      notificationGranted: _notificationPermissionGranted,
      accessibilityEnabled: _accessibilityEnabled,
      exactAlarmGranted: _exactAlarmGranted,
      batteryOptGranted: _batteryOptGranted,
      isPoweredOn: _isPoweredOn,
      subscriptionInfo: _subscriptionInfo,
      lastUssdResponse: _lastUssdResponse,
      lastJobOutcome: _lastJobOutcome,
      lastServiceName: _lastServiceName,
      onTogglePower: _togglePower,
      onRunNow: _runQueueTick,
      onReloadSubscription: _refreshSubscription,
      onRequestPermissions: _requestPermissions,
      onOpenAccessibility: _nativeBridge.openAccessibilitySettings,
      onOpenExactAlarmSettings: _nativeBridge.openExactAlarmSettings,
      onOpenSettings: () async {
        if (_processing) return;
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SettingsPage(
              backendUrlController: _backendUrlController,
              tokenController: _tokenController,
              deviceNameController: _deviceNameController,
              config: _config,
              backendConfigured: _backendConfigured,
              saving: _savingBackendUrl,
              registering: _registering,
              phoneGranted: _phonePermissionGranted,
              smsGranted: _smsPermissionGranted,
              notificationGranted: _notificationPermissionGranted,
              accessibilityEnabled: _accessibilityEnabled,
              exactAlarmGranted: _exactAlarmGranted,
              batteryOptGranted: _batteryOptGranted,
              lastError: _lastError,
              onSaveUrl: _saveBackendUrl,
              onResetUrl: _resetBackendUrl,
              onScanQr: _scanQrCode,
              onRequestPermissions: _requestPermissions,
              onOpenAccessibility: _nativeBridge.openAccessibilitySettings,
              onOpenExactAlarmSettings: _nativeBridge.openExactAlarmSettings,
              onRegister: _registerDevice,
              onResetDevice: _resetDevice,
            ),
          ),
        );
        // Refresh after settings close
        await _refreshCapabilities();
        if (mounted) setState(() {});
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SetupScreen — first-run wizard (2 steps: Permissions → Connect)
// ─────────────────────────────────────────────────────────────────────────────

class SetupScreen extends StatefulWidget {
  const SetupScreen({
    super.key,
    required this.backendUrlController,
    required this.tokenController,
    required this.deviceNameController,
    required this.saving,
    required this.registering,
    required this.phoneGranted,
    required this.smsGranted,
    required this.notificationGranted,
    required this.accessibilityEnabled,
    required this.exactAlarmGranted,
    required this.batteryOptGranted,
    required this.onSaveUrl,
    required this.onScanQr,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onOpenExactAlarmSettings,
    required this.onRegister,
    required this.lastError,
    required this.backendConfigured,
    required this.registered,
    required this.deviceName,
    required this.deviceId,
  });

  final TextEditingController backendUrlController;
  final TextEditingController tokenController;
  final TextEditingController deviceNameController;
  final bool saving;
  final bool registering;
  final bool phoneGranted;
  final bool smsGranted;
  final bool notificationGranted;
  final bool accessibilityEnabled;
  final bool exactAlarmGranted;
  final bool batteryOptGranted;
  final Future<void> Function() onSaveUrl;
  final Future<void> Function() onScanQr;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onOpenExactAlarmSettings;
  final Future<void> Function() onRegister;
  final String? lastError;
  final bool backendConfigured;
  final bool registered;
  final String? deviceName;
  final String? deviceId;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  late final PageController _page;
  late int _step;

  bool get _allPermsOk =>
      widget.phoneGranted &&
      widget.smsGranted &&
      widget.notificationGranted &&
      widget.accessibilityEnabled &&
      widget.exactAlarmGranted &&
      widget.batteryOptGranted;

  @override
  void initState() {
    super.initState();
    _step = _allPermsOk ? 1 : 0;
    _page = PageController(initialPage: _step);
  }

  void _goNext() {
    setState(() => _step = 1);
    _page.animateToPage(
      1,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOutCubic,
    );
  }

  void _goBack() {
    setState(() => _step = 0);
    _page.animateToPage(
      0,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOutCubic,
    );
  }

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: cs.surface,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: cs.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.bolt_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'dRecharge Agent',
                    style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  _StepIndicator(current: _step, total: 2),
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _page,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _SetupPermissionsStep(
                    phoneGranted: widget.phoneGranted,
                    smsGranted: widget.smsGranted,
                    notificationGranted: widget.notificationGranted,
                    accessibilityEnabled: widget.accessibilityEnabled,
                    exactAlarmGranted: widget.exactAlarmGranted,
                    batteryOptGranted: widget.batteryOptGranted,
                    onRequestPermissions: widget.onRequestPermissions,
                    onOpenAccessibility: widget.onOpenAccessibility,
                    onOpenExactAlarmSettings: widget.onOpenExactAlarmSettings,
                    onNext: _goNext,
                    allOk: _allPermsOk,
                  ),
                  _SetupRegisterStep(
                    backendUrlController: widget.backendUrlController,
                    tokenController: widget.tokenController,
                    deviceNameController: widget.deviceNameController,
                    saving: widget.saving,
                    registering: widget.registering,
                    backendConfigured: widget.backendConfigured,
                    registered: widget.registered,
                    deviceName: widget.deviceName,
                    deviceId: widget.deviceId,
                    lastError: widget.lastError,
                    onSaveUrl: widget.onSaveUrl,
                    onRegister: widget.onRegister,
                    onScanQr: widget.onScanQr,
                    onBack: _goBack,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.current, required this.total});
  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(total * 2 - 1, (i) {
        if (i.isOdd) {
          final lineActive = (i ~/ 2) < current;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 20,
            height: 2,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              color: lineActive ? cs.primary : cs.outlineVariant,
              borderRadius: BorderRadius.circular(1),
            ),
          );
        }
        final dotIndex = i ~/ 2;
        final isDone = dotIndex < current;
        final isActive = dotIndex == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: isDone || isActive ? cs.primary : cs.surfaceContainerHighest,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: isDone
                ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                : Text(
                    '${dotIndex + 1}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: isActive ? Colors.white : cs.onSurfaceVariant,
                    ),
                  ),
          ),
        );
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Permissions
// ─────────────────────────────────────────────────────────────────────────────

class _SetupPermissionsStep extends StatelessWidget {
  const _SetupPermissionsStep({
    required this.phoneGranted,
    required this.smsGranted,
    required this.notificationGranted,
    required this.accessibilityEnabled,
    required this.exactAlarmGranted,
    required this.batteryOptGranted,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onOpenExactAlarmSettings,
    required this.onNext,
    required this.allOk,
  });

  final bool phoneGranted;
  final bool smsGranted;
  final bool notificationGranted;
  final bool accessibilityEnabled;
  final bool exactAlarmGranted;
  final bool batteryOptGranted;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onOpenExactAlarmSettings;
  final VoidCallback onNext;
  final bool allOk;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final needsRuntime = !phoneGranted || !smsGranted || !notificationGranted;
    final needsAccessibility = !accessibilityEnabled;
    final needsAlarm = !exactAlarmGranted;
    final needsBattery = !batteryOptGranted;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: cs.primaryContainer,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.security_rounded, size: 30, color: cs.primary),
          ),
          const SizedBox(height: 18),
          Text(
            'Grant Permissions',
            style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            'The agent needs these to dial USSD codes and verify recharge confirmations.',
            style: tt.bodyMedium?.copyWith(
              color: cs.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          _PermCard(
            icon: Icons.phone_rounded,
            title: 'Phone & Calls',
            desc: 'Dial USSD codes on your behalf',
            granted: phoneGranted,
          ),
          const SizedBox(height: 8),
          _PermCard(
            icon: Icons.sms_rounded,
            title: 'SMS Read',
            desc: 'Verify recharge confirmations',
            granted: smsGranted,
          ),
          const SizedBox(height: 8),
          _PermCard(
            icon: Icons.notifications_active_rounded,
            title: 'Notifications',
            desc: 'Keep foreground service visible',
            granted: notificationGranted,
          ),
          const SizedBox(height: 8),
          _PermCard(
            icon: Icons.accessibility_new_rounded,
            title: 'Accessibility Service',
            desc: 'Auto-interact with USSD dialogs',
            granted: accessibilityEnabled,
          ),
          const SizedBox(height: 8),
          _PermCard(
            icon: Icons.alarm_rounded,
            title: 'Exact Alarms',
            desc: 'Schedule precise retry timers',
            granted: exactAlarmGranted,
          ),
          const SizedBox(height: 8),
          _PermCard(
            icon: Icons.battery_charging_full_rounded,
            title: 'Battery Optimization',
            desc: 'Keep agent running in background',
            granted: batteryOptGranted,
          ),
          const SizedBox(height: 24),
          if (needsRuntime)
            _SetupActionButton(
              icon: Icons.security_rounded,
              label: 'Grant Phone, SMS & Notifications',
              onTap: onRequestPermissions,
            ),
          if (needsAccessibility) ...[
            if (needsRuntime) const SizedBox(height: 8),
            _SetupActionButton(
              icon: Icons.accessibility_new_rounded,
              label: 'Enable Accessibility Service',
              onTap: onOpenAccessibility,
            ),
          ],
          if (needsAlarm) ...[
            const SizedBox(height: 8),
            _SetupActionButton(
              icon: Icons.alarm_rounded,
              label: 'Allow Exact Alarms (Android 12+)',
              onTap: onOpenExactAlarmSettings,
            ),
          ],
          if (needsBattery) ...[
            const SizedBox(height: 8),
            _SetupActionButton(
              icon: Icons.battery_charging_full_rounded,
              label: 'Exclude from Battery Saver',
              onTap: () => NativeBridge().openBatterySettings(),
            ),
          ],
          const SizedBox(height: 8),
          _SetupActionButton(
            icon: Icons.lock_open_rounded,
            label: 'Allow Restricted Settings (Android 13+)',
            onTap: () => NativeBridge().openAppInfo(),
            outlined: true,
          ),
          if (allOk) ...[
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onNext,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: const Text('Continue'),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ] else ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 16,
                    color: cs.onSurfaceVariant,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Grant all permissions above to continue.',
                      style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PermCard extends StatelessWidget {
  const _PermCard({
    required this.icon,
    required this.title,
    required this.desc,
    required this.granted,
  });
  final IconData icon;
  final String title;
  final String desc;
  final bool granted;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: granted
            ? cs.primaryContainer.withValues(alpha: 0.35)
            : cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: granted
              ? cs.primary.withValues(alpha: 0.3)
              : cs.outlineVariant,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: granted ? cs.primary : cs.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              size: 18,
              color: granted ? Colors.white : cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  desc,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            granted
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded,
            color: granted ? cs.primary : cs.outlineVariant,
            size: 20,
          ),
        ],
      ),
    );
  }
}

class _SetupActionButton extends StatelessWidget {
  const _SetupActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.outlined = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    if (outlined) {
      return OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 17),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(double.infinity, 46),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    }
    return FilledButton.tonal(
      onPressed: onTap,
      style: FilledButton.styleFrom(
        minimumSize: const Size(double.infinity, 46),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [Icon(icon, size: 17), const SizedBox(width: 8), Text(label)],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Connect (server URL + device registration)
// ─────────────────────────────────────────────────────────────────────────────

class _SetupRegisterStep extends StatelessWidget {
  const _SetupRegisterStep({
    required this.backendUrlController,
    required this.tokenController,
    required this.deviceNameController,
    required this.saving,
    required this.registering,
    required this.backendConfigured,
    required this.registered,
    required this.deviceName,
    required this.deviceId,
    required this.lastError,
    required this.onSaveUrl,
    required this.onRegister,
    required this.onScanQr,
    required this.onBack,
  });

  final TextEditingController backendUrlController;
  final TextEditingController tokenController;
  final TextEditingController deviceNameController;
  final bool saving;
  final bool registering;
  final bool backendConfigured;
  final bool registered;
  final String? deviceName;
  final String? deviceId;
  final String? lastError;
  final Future<void> Function() onSaveUrl;
  final Future<void> Function() onRegister;
  final Future<void> Function() onScanQr;
  final VoidCallback onBack;

  bool get _busy => saving || registering;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: cs.primaryContainer,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.qr_code_scanner_rounded,
              size: 30,
              color: cs.primary,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Connect Device',
            style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            'Scan the QR code from your admin panel to connect and register in one step.',
            style: tt.bodyMedium?.copyWith(
              color: cs.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          if (registered) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cs.primaryContainer.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: cs.primary.withValues(alpha: 0.16)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.verified_rounded, color: cs.primary, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          deviceName ?? 'Registered device',
                          style: tt.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: cs.onPrimaryContainer,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          deviceId ?? 'Connected to server',
                          style: tt.bodySmall?.copyWith(
                            fontFamily: 'monospace',
                            color: cs.onPrimaryContainer.withValues(
                              alpha: 0.75,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: null,
              icon: const Icon(Icons.check_circle_rounded, size: 18),
              label: const Text('Device Ready'),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                const Expanded(child: Divider()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(
                    'reconnect manually',
                    style: tt.bodySmall?.copyWith(color: cs.outline),
                  ),
                ),
                const Expanded(child: Divider()),
              ],
            ),
            const SizedBox(height: 18),
          ],
          FilledButton.icon(
            onPressed: _busy ? null : onScanQr,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.qr_code_scanner_rounded, size: 20),
            label: Text(_busy ? 'Connecting…' : 'Scan QR Code'),
            style: FilledButton.styleFrom(
              minimumSize: const Size(double.infinity, 54),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              textStyle: tt.labelLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: cs.primaryContainer.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: cs.primary.withValues(alpha: 0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.auto_awesome_rounded, color: cs.primary, size: 16),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Admin Panel → Devices → Register Device → Show QR',
                    style: tt.bodySmall?.copyWith(
                      color: cs.onPrimaryContainer,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              const Expanded(child: Divider()),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'or enter manually',
                  style: tt.bodySmall?.copyWith(color: cs.outline),
                ),
              ),
              const Expanded(child: Divider()),
            ],
          ),
          const SizedBox(height: 18),
          TextField(
            controller: backendUrlController,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(
              labelText: 'Server URL',
              hintText: 'https://admin.example.com',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              prefixIcon: const Icon(Icons.link_rounded, size: 20),
              suffixIcon: backendConfigured
                  ? Icon(Icons.check_circle_rounded, color: cs.primary)
                  : null,
              filled: true,
              fillColor: cs.surfaceContainerLow,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: deviceNameController,
            decoration: InputDecoration(
              labelText: 'Device Name (optional)',
              hintText: 'Auto-detected if left blank',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              prefixIcon: const Icon(Icons.phone_android_rounded, size: 20),
              filled: true,
              fillColor: cs.surfaceContainerLow,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: tokenController,
            minLines: 2,
            maxLines: 4,
            decoration: InputDecoration(
              labelText: 'Registration Token',
              hintText: 'Paste token from admin panel',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              prefixIcon: const Icon(Icons.vpn_key_rounded, size: 20),
              alignLabelWithHint: true,
              filled: true,
              fillColor: cs.surfaceContainerLow,
            ),
          ),
          if (lastError != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cs.errorContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline_rounded, color: cs.error, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      lastError!,
                      style: tt.bodySmall?.copyWith(color: cs.onErrorContainer),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: OutlinedButton(
                  onPressed: _busy ? null : onBack,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Back'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 3,
                child: FilledButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          await onSaveUrl();
                          await onRegister();
                        },
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _busy
                      ? const _LoadingIndicator()
                      : const Text('Register'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen — main app shell after setup
// ─────────────────────────────────────────────────────────────────────────────

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.config,
    required this.status,
    required this.currentJobId,
    required this.lastError,
    required this.processing,
    required this.logs,
    required this.phoneGranted,
    required this.smsGranted,
    required this.notificationGranted,
    required this.accessibilityEnabled,
    required this.exactAlarmGranted,
    required this.batteryOptGranted,
    required this.isPoweredOn,
    required this.subscriptionInfo,
    required this.lastUssdResponse,
    required this.lastJobOutcome,
    required this.lastServiceName,
    required this.onTogglePower,
    required this.onRunNow,
    required this.onReloadSubscription,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onOpenExactAlarmSettings,
    required this.onOpenSettings,
  });

  final AgentConfig? config;
  final String status;
  final String? currentJobId;
  final String? lastError;
  final bool processing;
  final List<String> logs;
  final bool phoneGranted;
  final bool smsGranted;
  final bool notificationGranted;
  final bool accessibilityEnabled;
  final bool exactAlarmGranted;
  final bool batteryOptGranted;
  final bool isPoweredOn;
  final SubscriptionInfo? subscriptionInfo;
  final String? lastUssdResponse;
  final String? lastJobOutcome;
  final String? lastServiceName;
  final Future<void> Function() onTogglePower;
  final Future<void> Function() onRunNow;
  final Future<void> Function() onReloadSubscription;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onOpenExactAlarmSettings;
  final Future<void> Function() onOpenSettings;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final hasIssue =
        !widget.phoneGranted ||
        !widget.smsGranted ||
        !widget.notificationGranted ||
        !widget.accessibilityEnabled ||
        !widget.exactAlarmGranted ||
        !widget.batteryOptGranted;

    final Color chipBg = widget.processing
        ? cs.secondaryContainer
        : widget.isPoweredOn
        ? cs.primaryContainer
        : cs.surfaceContainerHighest;
    final Color chipFg = widget.processing
        ? cs.onSecondaryContainer
        : widget.isPoweredOn
        ? cs.onPrimaryContainer
        : cs.onSurfaceVariant;

    return Scaffold(
      backgroundColor: cs.surfaceContainerLowest,
      appBar: AppBar(
        backgroundColor: cs.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: cs.primary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.bolt_rounded,
                color: Colors.white,
                size: 16,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'dRecharge Agent',
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 4),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: chipBg,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _StatusDot(
                  processing: widget.processing,
                  poweredOn: widget.isPoweredOn,
                  hasIssue: hasIssue,
                ),
                const SizedBox(width: 6),
                Text(
                  widget.processing
                      ? 'Running'
                      : widget.isPoweredOn
                      ? 'Active'
                      : 'Off',
                  style: tt.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: chipFg,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings_rounded),
            onPressed: widget.onOpenSettings,
            tooltip: 'Settings',
          ),
        ],
      ),
      body: IndexedStack(
        index: _tabIndex,
        children: [
          _DashboardTab(
            config: widget.config,
            status: widget.status,
            currentJobId: widget.currentJobId,
            lastError: widget.lastError,
            processing: widget.processing,
            logs: widget.logs,
            phoneGranted: widget.phoneGranted,
            smsGranted: widget.smsGranted,
            notificationGranted: widget.notificationGranted,
            accessibilityEnabled: widget.accessibilityEnabled,
            exactAlarmGranted: widget.exactAlarmGranted,
            batteryOptGranted: widget.batteryOptGranted,
            isPoweredOn: widget.isPoweredOn,
            subscriptionInfo: widget.subscriptionInfo,
            lastUssdResponse: widget.lastUssdResponse,
            lastJobOutcome: widget.lastJobOutcome,
            lastServiceName: widget.lastServiceName,
            onTogglePower: widget.onTogglePower,
            onRunNow: widget.onRunNow,
            onReloadSubscription: widget.onReloadSubscription,
            onRequestPermissions: widget.onRequestPermissions,
            onOpenAccessibility: widget.onOpenAccessibility,
            onOpenExactAlarmSettings: widget.onOpenExactAlarmSettings,
          ),
          _ActivityTab(logs: widget.logs),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        backgroundColor: cs.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        indicatorColor: cs.primaryContainer,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history_rounded),
            label: 'Activity',
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard tab
// ─────────────────────────────────────────────────────────────────────────────

class _DashboardTab extends StatelessWidget {
  const _DashboardTab({
    required this.config,
    required this.status,
    required this.currentJobId,
    required this.lastError,
    required this.processing,
    required this.logs,
    required this.phoneGranted,
    required this.smsGranted,
    required this.notificationGranted,
    required this.accessibilityEnabled,
    required this.exactAlarmGranted,
    required this.batteryOptGranted,
    required this.isPoweredOn,
    required this.subscriptionInfo,
    required this.lastUssdResponse,
    required this.lastJobOutcome,
    required this.lastServiceName,
    required this.onTogglePower,
    required this.onRunNow,
    required this.onReloadSubscription,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onOpenExactAlarmSettings,
  });

  final AgentConfig? config;
  final String status;
  final String? currentJobId;
  final String? lastError;
  final bool processing;
  final List<String> logs;
  final bool phoneGranted;
  final bool smsGranted;
  final bool notificationGranted;
  final bool accessibilityEnabled;
  final bool exactAlarmGranted;
  final bool batteryOptGranted;
  final bool isPoweredOn;
  final SubscriptionInfo? subscriptionInfo;
  final String? lastUssdResponse;
  final String? lastJobOutcome;
  final String? lastServiceName;
  final Future<void> Function() onTogglePower;
  final Future<void> Function() onRunNow;
  final Future<void> Function() onReloadSubscription;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onOpenExactAlarmSettings;

  @override
  Widget build(BuildContext context) {
    final hasIssue =
        !phoneGranted ||
        !smsGranted ||
        !notificationGranted ||
        !accessibilityEnabled ||
        !exactAlarmGranted ||
        !batteryOptGranted;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        if (subscriptionInfo != null)
          _LicenseBanner(
            subscriptionInfo: subscriptionInfo!,
            onReload: onReloadSubscription,
          ),
        if (subscriptionInfo != null) const SizedBox(height: 10),
        _StatusHeroCard(
          status: status,
          processing: processing,
          isPoweredOn: isPoweredOn,
          currentJobId: currentJobId,
          lastJobOutcome: lastJobOutcome,
          lastServiceName: lastServiceName,
          onTogglePower: onTogglePower,
          onRunNow: onRunNow,
        ),
        const SizedBox(height: 10),
        if (hasIssue) ...[
          _ReadinessCard(
            phoneGranted: phoneGranted,
            smsGranted: smsGranted,
            notificationGranted: notificationGranted,
            accessibilityEnabled: accessibilityEnabled,
            exactAlarmGranted: exactAlarmGranted,
            batteryOptGranted: batteryOptGranted,
            onRequestPermissions: onRequestPermissions,
            onOpenAccessibility: onOpenAccessibility,
            onOpenExactAlarmSettings: onOpenExactAlarmSettings,
          ),
          const SizedBox(height: 10),
        ],
        if (lastError != null) ...[
          _AlertBanner(
            message: lastError!,
            icon: Icons.error_outline_rounded,
            isError: true,
          ),
          const SizedBox(height: 10),
        ],
        _QuickActionsRow(
          processing: processing,
          isPoweredOn: isPoweredOn,
          onTogglePower: onTogglePower,
          onRunNow: onRunNow,
        ),
        if (lastUssdResponse != null && lastUssdResponse!.isNotEmpty) ...[
          const SizedBox(height: 10),
          _UssdResponseCard(
            response: lastUssdResponse!,
            outcome: lastJobOutcome,
            serviceName: lastServiceName,
          ),
        ],
        if (config != null) ...[
          const SizedBox(height: 10),
          _DeviceInfoCard(config: config!),
        ],
        if (subscriptionInfo != null) ...[
          const SizedBox(height: 10),
          _SubscriptionCard(
            info: subscriptionInfo!,
            onReload: onReloadSubscription,
          ),
        ],
        if (logs.isNotEmpty) ...[
          const SizedBox(height: 10),
          _RecentActivityPreview(logs: logs),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity tab
// ─────────────────────────────────────────────────────────────────────────────

class _ActivityTab extends StatelessWidget {
  const _ActivityTab({required this.logs});
  final List<String> logs;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    if (logs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history_rounded, size: 52, color: cs.outlineVariant),
            const SizedBox(height: 14),
            Text(
              'No activity yet',
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              'Agent logs will appear here',
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
          ],
        ),
      );
    }

    final reversed = logs.reversed.toList();
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: reversed.length,
      itemBuilder: (ctx, i) {
        final log = reversed[i];
        final lower = log.toLowerCase();
        final isError =
            lower.contains('error') ||
            lower.contains('fail') ||
            lower.contains('denied') ||
            lower.contains('✗');
        final isSuccess =
            lower.contains('success') ||
            lower.contains('done') ||
            lower.contains('✓');
        final isWarning =
            lower.contains('wait') ||
            lower.contains('retry') ||
            lower.contains('⏳');

        final Color dotColor = isError
            ? cs.error
            : isSuccess
            ? cs.primary
            : isWarning
            ? const Color(0xFFF59E0B)
            : cs.outlineVariant;

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24,
              child: Column(
                children: [
                  const SizedBox(height: 13),
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: dotColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (i < reversed.length - 1)
                    Container(
                      width: 1.5,
                      height: 30,
                      color: cs.outlineVariant.withValues(alpha: 0.4),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 6, top: 6, bottom: 16),
                child: Text(
                  log,
                  style: tt.bodySmall?.copyWith(
                    color: isError
                        ? cs.error
                        : isSuccess
                        ? cs.onSurface
                        : cs.onSurfaceVariant,
                    height: 1.45,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick actions row
// ─────────────────────────────────────────────────────────────────────────────

class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow({
    required this.processing,
    required this.isPoweredOn,
    required this.onTogglePower,
    required this.onRunNow,
  });

  final bool processing;
  final bool isPoweredOn;
  final Future<void> Function() onTogglePower;
  final Future<void> Function() onRunNow;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionChip(
            icon: isPoweredOn
                ? Icons.pause_circle_rounded
                : Icons.play_circle_rounded,
            label: isPoweredOn ? 'Pause' : 'Resume',
            onTap: onTogglePower,
            disabled: processing,
            danger: isPoweredOn,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ActionChip(
            icon: Icons.play_arrow_rounded,
            label: 'Run Now',
            onTap: onRunNow,
            disabled: processing || !isPoweredOn,
            primary: true,
          ),
        ),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.disabled = false,
    this.primary = false,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final Future<void> Function() onTap;
  final bool disabled;
  final bool primary;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final Color bg = primary
        ? cs.primaryContainer
        : danger
        ? cs.errorContainer
        : cs.surfaceContainerLow;
    final Color fg = primary
        ? cs.onPrimaryContainer
        : danger
        ? cs.onErrorContainer
        : cs.onSurfaceVariant;

    return Material(
      color: disabled ? cs.surfaceContainerLow.withValues(alpha: 0.5) : bg,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: disabled ? null : () => onTap(),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 17,
                color: disabled ? cs.onSurface.withValues(alpha: 0.38) : fg,
              ),
              const SizedBox(width: 7),
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: disabled ? cs.onSurface.withValues(alpha: 0.38) : fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Operating readiness
// ─────────────────────────────────────────────────────────────────────────────

class _ReadinessCard extends StatelessWidget {
  const _ReadinessCard({
    required this.phoneGranted,
    required this.smsGranted,
    required this.notificationGranted,
    required this.accessibilityEnabled,
    required this.exactAlarmGranted,
    required this.batteryOptGranted,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onOpenExactAlarmSettings,
  });

  final bool phoneGranted;
  final bool smsGranted;
  final bool notificationGranted;
  final bool accessibilityEnabled;
  final bool exactAlarmGranted;
  final bool batteryOptGranted;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onOpenExactAlarmSettings;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final missingRuntime = !phoneGranted || !smsGranted || !notificationGranted;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFFACC15).withValues(alpha: 0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFF92400E),
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Action required before operating',
                  style: tt.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF92400E),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _ReadinessPill(label: 'Phone', ok: phoneGranted),
              _ReadinessPill(label: 'SMS', ok: smsGranted),
              _ReadinessPill(label: 'Notify', ok: notificationGranted),
              _ReadinessPill(label: 'Access', ok: accessibilityEnabled),
              _ReadinessPill(label: 'Alarm', ok: exactAlarmGranted),
              _ReadinessPill(label: 'Battery', ok: batteryOptGranted),
            ],
          ),
          const SizedBox(height: 12),
          if (missingRuntime)
            _MiniFixButton(
              icon: Icons.security_rounded,
              label: 'Grant app permissions',
              onTap: onRequestPermissions,
            ),
          if (!accessibilityEnabled) ...[
            if (missingRuntime) const SizedBox(height: 8),
            _MiniFixButton(
              icon: Icons.accessibility_new_rounded,
              label: 'Enable accessibility',
              onTap: onOpenAccessibility,
            ),
          ],
          if (!exactAlarmGranted) ...[
            const SizedBox(height: 8),
            _MiniFixButton(
              icon: Icons.alarm_rounded,
              label: 'Allow exact alarms',
              onTap: onOpenExactAlarmSettings,
            ),
          ],
          if (!batteryOptGranted) ...[
            const SizedBox(height: 8),
            _MiniFixButton(
              icon: Icons.battery_charging_full_rounded,
              label: 'Open battery settings',
              onTap: () => NativeBridge().openBatterySettings(),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            'The agent stays paused until every required item is ready.',
            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _ReadinessPill extends StatelessWidget {
  const _ReadinessPill({required this.label, required this.ok});
  final String label;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: ok ? cs.primaryContainer.withValues(alpha: 0.55) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: ok ? cs.primary.withValues(alpha: 0.25) : cs.outlineVariant,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
            size: 13,
            color: ok ? cs.primary : cs.error,
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: ok ? cs.onPrimaryContainer : cs.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniFixButton extends StatelessWidget {
  const _MiniFixButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonalIcon(
      onPressed: () => onTap(),
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: FilledButton.styleFrom(
        minimumSize: const Size(double.infinity, 42),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert banner
// ─────────────────────────────────────────────────────────────────────────────

class _AlertBanner extends StatelessWidget {
  const _AlertBanner({
    required this.message,
    required this.icon,
    this.isError = false,
  });
  final String message;
  final IconData icon;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final Color bg = isError ? cs.errorContainer : const Color(0xFFFFF8E6);
    final Color fg = isError ? cs.onErrorContainer : const Color(0xFF92400E);

    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: fg,
                height: 1.4,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent activity preview
// ─────────────────────────────────────────────────────────────────────────────

class _RecentActivityPreview extends StatelessWidget {
  const _RecentActivityPreview({required this.logs});
  final List<String> logs;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final recent = logs.take(3).toList();

    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              children: [
                Icon(
                  Icons.history_rounded,
                  size: 14,
                  color: cs.onSurfaceVariant,
                ),
                const SizedBox(width: 7),
                Text(
                  'Recent Activity',
                  style: tt.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: cs.onSurfaceVariant,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: cs.outlineVariant.withValues(alpha: 0.4)),
          ...recent.map(
            (log) => Padding(
              padding: const EdgeInsets.fromLTRB(14, 9, 14, 9),
              child: Text(
                log,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
              ),
            ),
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// USSD response card
// ─────────────────────────────────────────────────────────────────────────────

class _UssdResponseCard extends StatelessWidget {
  const _UssdResponseCard({
    required this.response,
    required this.outcome,
    required this.serviceName,
  });
  final String response;
  final String? outcome;
  final String? serviceName;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final isSuccess = outcome == 'success';
    final isFailed = outcome == 'failed';

    final Color accent = isSuccess
        ? cs.primary
        : isFailed
        ? cs.error
        : const Color(0xFFF59E0B);
    final Color bg = isSuccess
        ? cs.primaryContainer.withValues(alpha: 0.35)
        : isFailed
        ? cs.errorContainer.withValues(alpha: 0.35)
        : const Color(0xFFFFFBEB);

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(13, 11, 13, 7),
            child: Row(
              children: [
                Icon(Icons.smartphone_rounded, size: 14, color: accent),
                const SizedBox(width: 7),
                Text(
                  'USSD Response',
                  style: tt.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: accent,
                    letterSpacing: 0.3,
                  ),
                ),
                const Spacer(),
                if (serviceName != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(
                      serviceName!,
                      style: tt.labelSmall?.copyWith(
                        color: accent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(13, 0, 13, 13),
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: cs.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: accent.withValues(alpha: 0.2)),
            ),
            child: Text(
              response,
              style: tt.bodySmall?.copyWith(
                fontFamily: 'monospace',
                color: cs.onSurface,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status hero card
// ─────────────────────────────────────────────────────────────────────────────

class _StatusHeroCard extends StatelessWidget {
  const _StatusHeroCard({
    required this.status,
    required this.processing,
    required this.isPoweredOn,
    required this.currentJobId,
    required this.lastJobOutcome,
    required this.lastServiceName,
    required this.onTogglePower,
    required this.onRunNow,
  });

  final String status;
  final bool processing;
  final bool isPoweredOn;
  final String? currentJobId;
  final String? lastJobOutcome;
  final String? lastServiceName;
  final Future<void> Function() onTogglePower;
  final Future<void> Function() onRunNow;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    final Color bg = processing
        ? cs.secondaryContainer
        : isPoweredOn
        ? cs.primaryContainer
        : cs.surfaceContainerHighest;
    final Color fg = processing
        ? cs.onSecondaryContainer
        : isPoweredOn
        ? cs.onPrimaryContainer
        : cs.onSurfaceVariant;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: fg.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: processing
                    ? Center(
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: fg,
                          ),
                        ),
                      )
                    : Icon(
                        isPoweredOn
                            ? Icons.bolt_rounded
                            : Icons.power_settings_new_rounded,
                        size: 24,
                        color: fg,
                      ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      processing
                          ? 'Processing'
                          : isPoweredOn
                          ? 'Agent Active'
                          : 'Agent Paused',
                      style: tt.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: fg,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      status,
                      style: tt.bodySmall?.copyWith(
                        color: fg.withValues(alpha: 0.75),
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              _PowerButton(
                isPoweredOn: isPoweredOn,
                onToggle: onTogglePower,
                disabled: processing,
                color: fg,
              ),
            ],
          ),
          if (currentJobId != null || lastJobOutcome != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: fg.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  if (processing && currentJobId != null) ...[
                    Icon(
                      Icons.pending_rounded,
                      size: 13,
                      color: fg.withValues(alpha: 0.7),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Job: ${currentJobId!.length > 14 ? '${currentJobId!.substring(0, 14)}…' : currentJobId}',
                      style: tt.labelSmall?.copyWith(
                        fontFamily: 'monospace',
                        color: fg.withValues(alpha: 0.8),
                      ),
                    ),
                  ] else if (lastJobOutcome != null) ...[
                    Icon(
                      lastJobOutcome == 'success'
                          ? Icons.check_circle_rounded
                          : lastJobOutcome == 'failed'
                          ? Icons.cancel_rounded
                          : Icons.hourglass_bottom_rounded,
                      size: 13,
                      color: fg.withValues(alpha: 0.7),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${lastJobOutcome == 'success'
                            ? 'Completed'
                            : lastJobOutcome == 'failed'
                            ? 'Failed'
                            : 'Waiting'}${lastServiceName != null ? ' · $lastServiceName' : ''}',
                        style: tt.labelSmall?.copyWith(
                          color: fg.withValues(alpha: 0.8),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Device info card
// ─────────────────────────────────────────────────────────────────────────────

class _DeviceInfoCard extends StatelessWidget {
  const _DeviceInfoCard({required this.config});
  final AgentConfig config;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.phone_android_rounded,
                size: 14,
                color: cs.onSurfaceVariant,
              ),
              const SizedBox(width: 7),
              Text(
                'This Device',
                style: tt.labelSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: cs.onSurfaceVariant,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _InfoRow(
            icon: Icons.badge_rounded,
            label: 'Name',
            value: config.name,
          ),
          const SizedBox(height: 5),
          _InfoRow(
            icon: Icons.fingerprint_rounded,
            label: 'ID',
            value: config.deviceId,
            mono: true,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// License banner (subscription owner branding)
// ─────────────────────────────────────────────────────────────────────────────

class _LicenseBanner extends StatefulWidget {
  const _LicenseBanner({
    required this.subscriptionInfo,
    required this.onReload,
  });
  final SubscriptionInfo subscriptionInfo;
  final Future<void> Function() onReload;

  @override
  State<_LicenseBanner> createState() => _LicenseBannerState();
}

class _LicenseBannerState extends State<_LicenseBanner> {
  bool _imgError = false;

  @override
  void didUpdateWidget(_LicenseBanner old) {
    super.didUpdateWidget(old);
    if (old.subscriptionInfo.logoFullUrl !=
        widget.subscriptionInfo.logoFullUrl) {
      setState(() => _imgError = false);
    }
  }

  String _fmtDate(DateTime d) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final info = widget.subscriptionInfo;
    final expiry = info.expiresAt;
    final bool expired = expiry != null && expiry.isBefore(DateTime.now());
    final bool expiringSoon =
        !expired &&
        expiry != null &&
        expiry.isBefore(DateTime.now().add(const Duration(days: 7)));

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: expired
              ? const [Color(0xFF7F1D1D), Color(0xFF991B1B)]
              : expiringSoon
              ? const [Color(0xFF78350F), Color(0xFF92400E)]
              : const [Color(0xFF134235), Color(0xFF1B6B4D)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          if (info.logoFullUrl != null && !_imgError)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                info.logoFullUrl!,
                width: 48,
                height: 48,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) {
                  WidgetsBinding.instance.addPostFrameCallback(
                    (_) => setState(() => _imgError = true),
                  );
                  return _logoPlaceholder();
                },
                loadingBuilder: (_, child, progress) => progress == null
                    ? child
                    : const _ShimmerPulse(width: 48, height: 48, radius: 10),
              ),
            )
          else
            _logoPlaceholder(),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  info.appName ?? 'Licensed',
                  style: tt.titleSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (expiry != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    expired
                        ? 'Subscription expired'
                        : expiringSoon
                        ? 'Expires ${_fmtDate(expiry)}'
                        : 'Active until ${_fmtDate(expiry)}',
                    style: tt.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.75),
                    ),
                  ),
                ],
              ],
            ),
          ),
          _ReloadButton(onReload: widget.onReload),
        ],
      ),
    );
  }

  Widget _logoPlaceholder() => Container(
    width: 48,
    height: 48,
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(10),
    ),
    child: const Icon(Icons.business_rounded, color: Colors.white, size: 24),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shimmer pulse (loading placeholder)
// ─────────────────────────────────────────────────────────────────────────────

class _ShimmerPulse extends StatefulWidget {
  const _ShimmerPulse({
    required this.width,
    required this.height,
    this.radius = 8,
  });
  final double width;
  final double height;
  final double radius;

  @override
  State<_ShimmerPulse> createState() => _ShimmerPulseState();
}

class _ShimmerPulseState extends State<_ShimmerPulse>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _anim = Tween<double>(
      begin: 0.25,
      end: 0.65,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: _anim.value),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription card
// ─────────────────────────────────────────────────────────────────────────────

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.info, required this.onReload});
  final SubscriptionInfo info;
  final Future<void> Function() onReload;

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  String _fmt(DateTime d) => '${d.day} ${_months[d.month - 1]}';

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final expiry = info.expiresAt;
    final expired = expiry != null && expiry.isBefore(DateTime.now());
    final expiringSoon =
        !expired &&
        expiry != null &&
        expiry.isBefore(DateTime.now().add(const Duration(days: 7)));

    final Color statusColor = expired
        ? cs.error
        : expiringSoon
        ? const Color(0xFFF59E0B)
        : cs.primary;

    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.workspace_premium_rounded,
              size: 20,
              color: statusColor,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Subscription',
                  style: tt.labelSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: cs.onSurfaceVariant,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  expired
                      ? 'Expired — contact your reseller'
                      : expiry == null
                      ? 'Lifetime access'
                      : expiringSoon
                      ? 'Expiring soon: ${_fmt(expiry)}'
                      : 'Active until ${_fmt(expiry)}',
                  style: tt.bodySmall?.copyWith(
                    color: expired ? cs.error : cs.onSurface,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 16),
            onPressed: () => onReload(),
            style: IconButton.styleFrom(
              foregroundColor: cs.onSurfaceVariant,
              padding: const EdgeInsets.all(8),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reload button (used in license banner)
// ─────────────────────────────────────────────────────────────────────────────

class _ReloadButton extends StatefulWidget {
  const _ReloadButton({required this.onReload});
  final Future<void> Function() onReload;

  @override
  State<_ReloadButton> createState() => _ReloadButtonState();
}

class _ReloadButtonState extends State<_ReloadButton> {
  bool _loading = false;

  Future<void> _tap() async {
    if (_loading) return;
    setState(() => _loading = true);
    try {
      await widget.onReload();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: _loading
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : const Icon(Icons.refresh_rounded, color: Colors.white, size: 18),
      onPressed: _loading ? null : _tap,
      style: IconButton.styleFrom(
        foregroundColor: Colors.white,
        backgroundColor: Colors.white.withValues(alpha: 0.15),
        padding: const EdgeInsets.all(8),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status dot indicator
// ─────────────────────────────────────────────────────────────────────────────

class _StatusDot extends StatelessWidget {
  const _StatusDot({
    required this.processing,
    required this.poweredOn,
    required this.hasIssue,
  });
  final bool processing;
  final bool poweredOn;
  final bool hasIssue;

  @override
  Widget build(BuildContext context) {
    final Color color = processing
        ? const Color(0xFF3B82F6)
        : hasIssue
        ? const Color(0xFFF59E0B)
        : poweredOn
        ? const Color(0xFF22C55E)
        : const Color(0xFF9CA3AF);
    return Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Info row (label + value)
// ─────────────────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.mono = false,
  });
  final IconData icon;
  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Row(
      children: [
        Icon(icon, size: 13, color: cs.onSurfaceVariant.withValues(alpha: 0.6)),
        const SizedBox(width: 7),
        Text(
          '$label  ',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        Expanded(
          child: Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: tt.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              fontFamily: mono ? 'monospace' : null,
              color: cs.onSurface,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Power toggle button
// ─────────────────────────────────────────────────────────────────────────────

class _PowerButton extends StatelessWidget {
  const _PowerButton({
    required this.isPoweredOn,
    required this.onToggle,
    this.disabled = false,
    this.color,
  });
  final bool isPoweredOn;
  final Future<void> Function() onToggle;
  final bool disabled;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final eff = color ?? Theme.of(context).colorScheme.onSurface;
    return IconButton(
      icon: Icon(
        isPoweredOn
            ? Icons.power_settings_new_rounded
            : Icons.power_off_rounded,
        color: disabled ? eff.withValues(alpha: 0.38) : eff,
        size: 20,
      ),
      onPressed: disabled ? null : () => onToggle(),
      style: IconButton.styleFrom(
        backgroundColor: eff.withValues(alpha: 0.12),
        padding: const EdgeInsets.all(10),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────────────────────

class SettingsPage extends StatelessWidget {
  const SettingsPage({
    super.key,
    required this.backendUrlController,
    required this.tokenController,
    required this.deviceNameController,
    required this.config,
    required this.backendConfigured,
    required this.saving,
    required this.registering,
    required this.phoneGranted,
    required this.smsGranted,
    required this.notificationGranted,
    required this.accessibilityEnabled,
    required this.exactAlarmGranted,
    required this.batteryOptGranted,
    required this.lastError,
    required this.onSaveUrl,
    required this.onResetUrl,
    required this.onScanQr,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onOpenExactAlarmSettings,
    required this.onRegister,
    required this.onResetDevice,
  });

  final TextEditingController backendUrlController;
  final TextEditingController tokenController;
  final TextEditingController deviceNameController;
  final AgentConfig? config;
  final bool backendConfigured;
  final bool saving;
  final bool registering;
  final bool phoneGranted;
  final bool smsGranted;
  final bool notificationGranted;
  final bool accessibilityEnabled;
  final bool exactAlarmGranted;
  final bool batteryOptGranted;
  final String? lastError;
  final Future<void> Function() onSaveUrl;
  final Future<void> Function() onResetUrl;
  final Future<void> Function() onScanQr;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onOpenExactAlarmSettings;
  final Future<void> Function() onRegister;
  final Future<void> Function() onResetDevice;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final registered = config != null;

    return Scaffold(
      backgroundColor: cs.surfaceContainerLowest,
      appBar: AppBar(
        title: const Text('Settings'),
        backgroundColor: cs.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          // ── Permissions ──────────────────────────────────────────────────
          _SectionHeader(title: 'Permissions'),
          _SettingsCard(
            child: Column(
              children: [
                _PermissionTile(
                  icon: Icons.phone_rounded,
                  title: 'Phone & Calls',
                  subtitle: 'CALL_PHONE + READ_PHONE_STATE',
                  granted: phoneGranted,
                ),
                _SettingsDivider(),
                _PermissionTile(
                  icon: Icons.sms_rounded,
                  title: 'SMS Read',
                  subtitle: 'READ_SMS + RECEIVE_SMS',
                  granted: smsGranted,
                ),
                _SettingsDivider(),
                _PermissionTile(
                  icon: Icons.notifications_active_rounded,
                  title: 'Notifications',
                  subtitle: 'Foreground service status',
                  granted: notificationGranted,
                ),
                _SettingsDivider(),
                _PermissionTile(
                  icon: Icons.accessibility_new_rounded,
                  title: 'Accessibility Service',
                  subtitle: 'Auto-interact with USSD dialogs',
                  granted: accessibilityEnabled,
                ),
                _SettingsDivider(),
                _PermissionTile(
                  icon: Icons.alarm_rounded,
                  title: 'Exact Alarms',
                  subtitle: 'Precise watchdog scheduling',
                  granted: exactAlarmGranted,
                ),
                _SettingsDivider(),
                _PermissionTile(
                  icon: Icons.battery_charging_full_rounded,
                  title: 'Battery Optimization',
                  subtitle: 'Background execution exemption',
                  granted: batteryOptGranted,
                ),
                if (!phoneGranted || !smsGranted || !notificationGranted) ...[
                  _SettingsDivider(),
                  _SettingsTile(
                    icon: Icons.security_rounded,
                    title: 'Grant App Permissions',
                    trailing: Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 13,
                      color: cs.onSurfaceVariant,
                    ),
                    onTap: () => onRequestPermissions(),
                  ),
                ],
                if (!accessibilityEnabled) ...[
                  _SettingsDivider(),
                  _SettingsTile(
                    icon: Icons.accessibility_new_rounded,
                    title: 'Enable Accessibility Service',
                    trailing: Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 13,
                      color: cs.onSurfaceVariant,
                    ),
                    onTap: () => onOpenAccessibility(),
                  ),
                ],
                if (!exactAlarmGranted) ...[
                  _SettingsDivider(),
                  _SettingsTile(
                    icon: Icons.alarm_rounded,
                    title: 'Allow Exact Alarms',
                    trailing: Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 13,
                      color: cs.onSurfaceVariant,
                    ),
                    onTap: () => onOpenExactAlarmSettings(),
                  ),
                ],
                if (!batteryOptGranted) ...[
                  _SettingsDivider(),
                  _SettingsTile(
                    icon: Icons.battery_charging_full_rounded,
                    title: 'Open Battery Settings',
                    trailing: Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 13,
                      color: cs.onSurfaceVariant,
                    ),
                    onTap: () => NativeBridge().openBatterySettings(),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 6),
          _SettingsCard(
            child: Column(
              children: [
                _SettingsTile(
                  icon: Icons.lock_open_rounded,
                  title: 'Allow Restricted Settings',
                  subtitle: 'Required on Android 13+',
                  trailing: Icon(
                    Icons.open_in_new_rounded,
                    size: 13,
                    color: cs.onSurfaceVariant,
                  ),
                  onTap: () => NativeBridge().openAppInfo(),
                ),
                _SettingsDivider(),
                _SettingsTile(
                  icon: Icons.battery_charging_full_rounded,
                  title: 'Battery Optimization',
                  subtitle: 'Exclude from battery saver',
                  trailing: Icon(
                    Icons.open_in_new_rounded,
                    size: 13,
                    color: cs.onSurfaceVariant,
                  ),
                  onTap: () => NativeBridge().openBatterySettings(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Backend Server ───────────────────────────────────────────────
          _SectionHeader(title: 'Backend Server'),
          _SettingsCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (backendConfigured) ...[
                    Row(
                      children: [
                        Icon(
                          Icons.check_circle_rounded,
                          size: 13,
                          color: cs.primary,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            BackendService.currentBaseUrl,
                            style: tt.bodySmall?.copyWith(
                              fontFamily: 'monospace',
                              color: cs.onSurfaceVariant,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (registered)
                    Container(
                      padding: const EdgeInsets.all(10),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: cs.tertiaryContainer,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            color: cs.onTertiaryContainer,
                            size: 13,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Changing the URL will unlink this device.',
                              style: tt.bodySmall?.copyWith(
                                color: cs.onTertiaryContainer,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  OutlinedButton.icon(
                    onPressed: saving ? null : onScanQr,
                    icon: const Icon(Icons.qr_code_scanner_rounded, size: 17),
                    label: const Text('Scan QR Code'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 44),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: backendUrlController,
                    keyboardType: TextInputType.url,
                    decoration: InputDecoration(
                      labelText: 'Server URL',
                      hintText: 'https://admin.example.com',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      prefixIcon: const Icon(Icons.link_rounded, size: 18),
                      isDense: true,
                      filled: true,
                      fillColor: cs.surfaceContainerLow,
                    ),
                  ),
                  if (lastError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      lastError!,
                      style: tt.bodySmall?.copyWith(color: cs.error),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: FilledButton(
                          onPressed: saving ? null : onSaveUrl,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(44),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: saving
                              ? const _LoadingIndicator()
                              : Text(
                                  backendConfigured
                                      ? 'Update URL'
                                      : 'Verify & Save',
                                ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: OutlinedButton(
                          onPressed: saving ? null : onResetUrl,
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(44),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: const Text('Reset'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── Device ───────────────────────────────────────────────────────
          _SectionHeader(title: registered ? 'Device' : 'Register Device'),
          if (registered)
            _SettingsCard(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        _InfoRow(
                          icon: Icons.phone_android_rounded,
                          label: 'Name',
                          value: config!.name,
                        ),
                        const SizedBox(height: 6),
                        _InfoRow(
                          icon: Icons.fingerprint_rounded,
                          label: 'ID',
                          value: config!.deviceId,
                          mono: true,
                        ),
                      ],
                    ),
                  ),
                  _SettingsDivider(),
                  _SettingsTile(
                    icon: Icons.logout_rounded,
                    title: 'Unlink Device',
                    subtitle: 'Removes this device from the server',
                    isDestructive: true,
                    onTap: () => onResetDevice(),
                  ),
                ],
              ),
            )
          else if (backendConfigured)
            _SettingsCard(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    FilledButton.icon(
                      onPressed: registering ? null : onScanQr,
                      icon: const Icon(Icons.qr_code_scanner_rounded, size: 17),
                      label: const Text('Scan QR to Register'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(double.infinity, 46),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'or manually',
                            style: tt.bodySmall?.copyWith(color: cs.outline),
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: deviceNameController,
                      decoration: InputDecoration(
                        labelText: 'Device Name (optional)',
                        hintText: 'Auto-detected if blank',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        prefixIcon: const Icon(
                          Icons.phone_android_rounded,
                          size: 17,
                        ),
                        isDense: true,
                        filled: true,
                        fillColor: cs.surfaceContainerLow,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: tokenController,
                      minLines: 2,
                      maxLines: 4,
                      decoration: InputDecoration(
                        labelText: 'Registration Token',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        prefixIcon: const Icon(Icons.vpn_key_rounded, size: 17),
                        alignLabelWithHint: true,
                        filled: true,
                        fillColor: cs.surfaceContainerLow,
                      ),
                    ),
                    if (lastError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        lastError!,
                        style: tt.bodySmall?.copyWith(color: cs.error),
                      ),
                    ],
                    const SizedBox(height: 10),
                    FilledButton(
                      onPressed: registering ? null : onRegister,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(double.infinity, 46),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: registering
                          ? const _LoadingIndicator()
                          : const Text('Register Device'),
                    ),
                  ],
                ),
              ),
            )
          else
            _SettingsCard(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline_rounded,
                      size: 16,
                      color: cs.onSurfaceVariant,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Configure the backend server first.',
                        style: tt.bodySmall?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared settings widgets
// ─────────────────────────────────────────────────────────────────────────────

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.6)),
      ),
      clipBehavior: Clip.hardEdge,
      child: child,
    );
  }
}

class _SettingsDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      thickness: 1,
      indent: 16,
      endIndent: 0,
      color: Theme.of(
        context,
      ).colorScheme.outlineVariant.withValues(alpha: 0.4),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.isDestructive = false,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool isDestructive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final Color fg = isDestructive ? cs.error : cs.onSurface;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Icon(
              icon,
              size: 18,
              color: isDestructive ? cs.error : cs.onSurfaceVariant,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: tt.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                      color: fg,
                    ),
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle!,
                      style: tt.bodySmall?.copyWith(
                        color: isDestructive
                            ? cs.error.withValues(alpha: 0.7)
                            : cs.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8, top: 2),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          letterSpacing: 1.1,
          fontWeight: FontWeight.w700,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

class _PermissionTile extends StatelessWidget {
  const _PermissionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.granted,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final bool granted;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: granted ? cs.primaryContainer : cs.errorContainer,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(
              icon,
              size: 17,
              color: granted ? cs.primary : cs.onErrorContainer,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  subtitle,
                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
            ),
          ),
          Icon(
            granted ? Icons.check_circle_rounded : Icons.cancel_rounded,
            size: 18,
            color: granted ? cs.primary : cs.error,
          ),
        ],
      ),
    );
  }
}

class _LoadingIndicator extends StatelessWidget {
  const _LoadingIndicator();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Scanner page
// ─────────────────────────────────────────────────────────────────────────────

class QrScanPage extends StatefulWidget {
  const QrScanPage({super.key});

  @override
  State<QrScanPage> createState() => _QrScanPageState();
}

class _QrScanPageState extends State<QrScanPage> {
  final MobileScannerController _controller = MobileScannerController();
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final value = capture.barcodes.firstOrNull?.rawValue;
    if (value == null || value.isEmpty) return;
    _handled = true;
    _controller.stop();
    Navigator.pop(context, value);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Scan QR Code',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_rounded, color: Colors.white),
            onPressed: () => _controller.toggleTorch(),
            tooltip: 'Toggle torch',
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          ColorFiltered(
            colorFilter: ColorFilter.mode(
              Colors.black.withValues(alpha: 0.55),
              BlendMode.srcOut,
            ),
            child: Stack(
              children: [
                Container(color: Colors.transparent),
                Center(
                  child: Container(
                    width: 256,
                    height: 256,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Center(
            child: SizedBox(
              width: 256,
              height: 256,
              child: CustomPaint(
                painter: _CornerFramePainter(color: cs.primary),
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 48),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Colors.black87, Colors.transparent],
                ),
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.2),
                  ),
                ),
                child: const Text(
                  'Point at the QR code from Admin Panel → Devices',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CornerFramePainter extends CustomPainter {
  _CornerFramePainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    const len = 26.0;
    const r = 16.0;
    // top-left
    canvas.drawLine(const Offset(r, 0), const Offset(r + len, 0), p);
    canvas.drawLine(const Offset(0, r), const Offset(0, r + len), p);
    canvas.drawArc(
      const Rect.fromLTWH(0, 0, r * 2, r * 2),
      3.14159,
      3.14159 / 2,
      false,
      p,
    );
    // top-right
    canvas.drawLine(
      Offset(size.width - r - len, 0),
      Offset(size.width - r, 0),
      p,
    );
    canvas.drawLine(Offset(size.width, r), Offset(size.width, r + len), p);
    canvas.drawArc(
      Rect.fromLTWH(size.width - r * 2, 0, r * 2, r * 2),
      -3.14159 / 2,
      3.14159 / 2,
      false,
      p,
    );
    // bottom-left
    canvas.drawLine(
      Offset(0, size.height - r - len),
      Offset(0, size.height - r),
      p,
    );
    canvas.drawLine(Offset(r, size.height), Offset(r + len, size.height), p);
    canvas.drawArc(
      Rect.fromLTWH(0, size.height - r * 2, r * 2, r * 2),
      3.14159 / 2,
      3.14159 / 2,
      false,
      p,
    );
    // bottom-right
    canvas.drawLine(
      Offset(size.width - r - len, size.height),
      Offset(size.width - r, size.height),
      p,
    );
    canvas.drawLine(
      Offset(size.width, size.height - r - len),
      Offset(size.width, size.height - r),
      p,
    );
    canvas.drawArc(
      Rect.fromLTWH(size.width - r * 2, size.height - r * 2, r * 2, r * 2),
      0,
      3.14159 / 2,
      false,
      p,
    );
  }

  @override
  bool shouldRepaint(_CornerFramePainter old) => old.color != color;
}
