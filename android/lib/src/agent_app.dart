/// dRecharge Agent — redesigned UI/UX
/// Navigation:
///   SetupScreen  → first-run wizard (permissions + backend + register)
///   HomeScreen   → clean status dashboard (the main screen)
///   SettingsPage → backend URL, permissions, device registration / reset

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  bool _accessibilityEnabled = false;
  bool _exactAlarmGranted = false;
  bool _batteryOptGranted = false;
  bool _isPoweredOn = true;   // master power switch
  String _status = 'Idle';
  String? _currentJobId;
  String? _lastError;
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
    final accessibilityEnabled = await _nativeBridge.isAccessibilityEnabled();
    final exactAlarm = await _nativeBridge.isExactAlarmGranted();
    final batteryOpt = await Permission.ignoreBatteryOptimizations.isGranted;
    if (!mounted) return;
    setState(() {
      _phonePermissionGranted = phoneStatus.isGranted;
      _smsPermissionGranted = smsStatus.isGranted;
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
      _phonePermissionGranted && _smsPermissionGranted && _accessibilityEnabled;

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
      if (bootstrap['success'] != true)
        throw Exception('Endpoint validation failed.');

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
    Future.delayed(const Duration(seconds: 10), () => unawaited(_uploadRecentSms()));
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
        _appendLog(serverPowerState ? 'Agent powered ON remotely.' : 'Agent powered OFF remotely.');
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
      if (mounted) setState(() => _status = 'Suspended — subscription ${sub.state}');
      return;
    }

    if (!_phonePermissionGranted ||
        !_smsPermissionGranted ||
        !_accessibilityEnabled) {
      if (mounted)
        setState(() => _status = 'Waiting for permissions/accessibility');
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
        _status = 'Processing ${liveJob.serviceName.isNotEmpty ? liveJob.serviceName : 'Unknown Service'}';
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

      final startedAtMs = DateTime.now().millisecondsSinceEpoch;
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

      // Wait for SMS confirmation using the job's embedded SMS formats & timeout.
      final matchResult = await _waitForConfirmationSms(
        sinceMs: startedAtMs,
        job: liveJob,
      );

      final rawSms = matchResult.sms?.body ?? '';
      final parsedResult = matchResult.hasMatch
          ? <String, dynamic>{
              'success': matchResult.isSuccess,
              if (matchResult.failureReason != null)
                'reason': matchResult.failureReason,
            }
          : <String, dynamic>{
              'success': false,
              'reason':
                  'No confirmation SMS received within ${liveJob.smsTimeout}s',
            };

      await BackendService.reportJobResult(
        jobId: liveJob.jobId,
        txId: liveJob.txId,
        serviceName: liveJob.serviceName,
        recipientNumber: liveJob.recipientNumber,
        amount: liveJob.amount,
        rawSms: rawSms,
        isSuccess: matchResult.isSuccess,
        parsedResult: parsedResult,
        ussdStepsExecuted: stepsExecuted,
      );
      await _nativeBridge.releaseWakeLock().catchError((_) {});
      _appendLog(
        matchResult.isSuccess
            ? '✓ ${liveJob.serviceName} → ${liveJob.recipientNumber} · ৳${liveJob.amount}'
            : '✗ ${liveJob.serviceName} → ${liveJob.recipientNumber} · ৳${liveJob.amount}',
      );
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
      if (mounted)
        setState(() {
          _lastError = error.toString();
          _status = 'Error';
        });
    } finally {
      _processing = false;
      _currentJobId = null;
      await _sendHeartbeat();
      if (mounted && _status.startsWith('Processing'))
        setState(() => _status = 'Idle');
    }
  }

  /// Waits for an SMS confirmation using the job's embedded SMS templates and timeout.
  Future<SmsMatchResult> _waitForConfirmationSms({
    required int sinceMs,
    required ExecutionJob job,
  }) async {
    final timeoutSeconds = job.smsTimeout;
    final deadline = DateTime.now().add(Duration(seconds: timeoutSeconds));
    while (DateTime.now().isBefore(deadline)) {
      final messages = await _nativeBridge.readRecentSms(
        sinceMs: sinceMs,
        maxMessages: 12,
      );
      final matchResult = BackendService.matchIncomingSms(
        messages: messages,
        job: job,
      );
      if (matchResult.hasMatch) return matchResult;
      await Future<void>.delayed(const Duration(seconds: 4));
    }
    return const SmsMatchResult(
      sms: null,
      isSuccess: false,
      failureReason: null,
    );
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
    );
    _appendLog('✗ ${job.serviceName} → ${job.recipientNumber} · ৳${job.amount}');
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

    // First-time setup: no backend configured → show setup wizard
    final bool setupComplete = _backendConfigured && _allPermissionsOk;
    if (!setupComplete && _config == null && !_backendConfigured) {
      return SetupScreen(
        backendUrlController: _backendUrlController,
        tokenController: _tokenController,
        deviceNameController: _deviceNameController,
        saving: _savingBackendUrl,
        registering: _registering,
        phoneGranted: _phonePermissionGranted,
        smsGranted: _smsPermissionGranted,
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
      accessibilityEnabled: _accessibilityEnabled,
      isPoweredOn: _isPoweredOn,
      subscriptionInfo: _subscriptionInfo,
      onTogglePower: _togglePower,
      onRunNow: _runQueueTick,
      onReloadSubscription: _refreshSubscription,
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
              accessibilityEnabled: _accessibilityEnabled,
              lastError: _lastError,
              onSaveUrl: _saveBackendUrl,
              onResetUrl: _resetBackendUrl,
              onScanQr: _scanQrCode,
              onRequestPermissions: _requestPermissions,
              onOpenAccessibility: _nativeBridge.openAccessibilitySettings,
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
// SetupScreen — first-run wizard (2 steps)
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
  });

  // NOTE: The QR code from the admin panel contains both the server URL and a
  // registration token. Scanning it once auto-saves the URL and registers the
  // device — no separate backend step needed.

  final TextEditingController backendUrlController;
  final TextEditingController tokenController;
  final TextEditingController deviceNameController;
  final bool saving;
  final bool registering;
  final bool phoneGranted;
  final bool smsGranted;
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

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<String> _pageTitles = ['Permissions', 'Register Device'];

  void _goNext() {
    if (_currentPage < 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
      setState(() => _currentPage++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: cs.surface,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ─────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: cs.primaryContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.bolt_rounded,
                          color: cs.primary,
                          size: 26,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'dRecharge Agent',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Device Setup',
                            style: Theme.of(
                              context,
                            ).textTheme.bodySmall?.copyWith(color: cs.outline),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  // Step indicator — 2 steps
                  Row(
                    children: List.generate(2, (i) {
                      final active = i == _currentPage;
                      final done = i < _currentPage;
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(right: i < 1 ? 6 : 0),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 250),
                            height: 5,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: done || active
                                  ? cs.primary
                                  : cs.surfaceContainerHighest,
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Step ${_currentPage + 1} of 2 — ${_pageTitles[_currentPage]}',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: cs.outline),
                  ),
                ],
              ),
            ),

            // ── Page content ────────────────────────────────────────────────
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  // Step 1: Permissions
                  _SetupPermissionsStep(
                    phoneGranted: widget.phoneGranted,
                    smsGranted: widget.smsGranted,
                    accessibilityEnabled: widget.accessibilityEnabled,
                    exactAlarmGranted: widget.exactAlarmGranted,
                    batteryOptGranted: widget.batteryOptGranted,
                    onRequestPermissions: widget.onRequestPermissions,
                    onOpenAccessibility: widget.onOpenAccessibility,
                    onOpenExactAlarmSettings: widget.onOpenExactAlarmSettings,
                    onNext: _goNext,
                  ),
                  // Step 2: Register (one-scan QR does URL + registration)
                  _SetupRegisterStep(
                    backendUrlController: widget.backendUrlController,
                    tokenController: widget.tokenController,
                    deviceNameController: widget.deviceNameController,
                    saving: widget.saving,
                    registering: widget.registering,
                    backendConfigured: widget.backendConfigured,
                    lastError: widget.lastError,
                    onSaveUrl: widget.onSaveUrl,
                    onRegister: widget.onRegister,
                    onScanQr: widget.onScanQr,
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

class _SetupPermissionsStep extends StatelessWidget {
  const _SetupPermissionsStep({
    required this.phoneGranted,
    required this.smsGranted,
    required this.accessibilityEnabled,
    required this.exactAlarmGranted,
    required this.batteryOptGranted,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onOpenExactAlarmSettings,
    required this.onNext,
  });

  final bool phoneGranted;
  final bool smsGranted;
  final bool accessibilityEnabled;
  final bool exactAlarmGranted;
  final bool batteryOptGranted;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onOpenExactAlarmSettings;
  final VoidCallback onNext;

  bool get _allOk => phoneGranted && smsGranted && accessibilityEnabled;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Text(
            'Required Permissions',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'The agent needs these permissions to automatically execute USSD requests.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 28),
          _PermissionTile(
            icon: Icons.phone,
            title: 'Phone & Calls',
            subtitle: 'Dial USSD codes and read SIM info',
            granted: phoneGranted,
          ),
          const SizedBox(height: 12),
          _PermissionTile(
            icon: Icons.sms,
            title: 'SMS Read',
            subtitle: 'Read confirmation messages',
            granted: smsGranted,
          ),
          const SizedBox(height: 12),
          _PermissionTile(
            icon: Icons.accessibility_new,
            title: 'Accessibility Service',
            subtitle: 'Auto-fill USSD dialogs',
            granted: accessibilityEnabled,
          ),
          const SizedBox(height: 12),
          _PermissionTile(
            icon: Icons.alarm_rounded,
            title: 'Exact Alarms',
            subtitle: 'Keep background service alive (Android 12+)',
            granted: exactAlarmGranted,
          ),
          const SizedBox(height: 12),
          _PermissionTile(
            icon: Icons.battery_charging_full_rounded,
            title: 'Battery Optimization Exempt',
            subtitle: 'Prevent OS from killing the agent',
            granted: batteryOptGranted,
          ),
          const Spacer(),
          if (!phoneGranted || !smsGranted)
            FilledButton.icon(
              onPressed: onRequestPermissions,
              icon: const Icon(Icons.security),
              label: const Text('Grant Phone & SMS Permissions'),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
          if (!accessibilityEnabled) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onOpenAccessibility,
              icon: const Icon(Icons.accessibility_new),
              label: const Text('Open Accessibility Settings'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
              ),
            ),
          ],
          if (!exactAlarmGranted) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: onOpenExactAlarmSettings,
              icon: const Icon(Icons.alarm_rounded),
              label: const Text('Allow Exact Alarms (Android 12+)'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
              ),
            ),
          ],
          if (!batteryOptGranted) ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => NativeBridge().openBatterySettings(),
              icon: const Icon(Icons.battery_charging_full_rounded),
              label: const Text('Exclude from Battery Optimization'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
              ),
            ),
          ],
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => NativeBridge().openAppInfo(),
            icon: const Icon(Icons.lock_open_rounded),
            label: const Text('Allow Restricted Settings (Android 13+)'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 44),
            ),
          ),
          if (_allOk) ...[
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: onNext,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('Continue'),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// Merged step: server URL + device registration.
// Primary path: scan admin QR (contains both URL and token) → one-shot register.
// Manual fallback: enter server URL then token separately.
class _SetupRegisterStep extends StatelessWidget {
  const _SetupRegisterStep({
    required this.backendUrlController,
    required this.tokenController,
    required this.deviceNameController,
    required this.saving,
    required this.registering,
    required this.backendConfigured,
    required this.lastError,
    required this.onSaveUrl,
    required this.onRegister,
    required this.onScanQr,
  });

  final TextEditingController backendUrlController;
  final TextEditingController tokenController;
  final TextEditingController deviceNameController;
  final bool saving;
  final bool registering;
  final bool backendConfigured;
  final String? lastError;
  final Future<void> Function() onSaveUrl;
  final Future<void> Function() onRegister;
  final Future<void> Function() onScanQr;

  bool get _busy => saving || registering;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Text(
            'Register Device',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Scan the QR code from the admin panel to connect and register in one step.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          // One-scan tip
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: cs.primaryContainer.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.auto_awesome_rounded, color: cs.primary, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'One scan registers this device automatically — no manual URL or token entry needed.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: cs.onPrimaryContainer,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Primary CTA: scan QR → full registration
          FilledButton.icon(
            onPressed: _busy ? null : onScanQr,
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.qr_code_scanner),
            label: Text(_busy ? 'Registering…' : 'Scan QR to Register'),
            style: FilledButton.styleFrom(
              minimumSize: const Size(double.infinity, 52),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(child: Divider()),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'or enter manually',
                  style: TextStyle(color: cs.outline, fontSize: 12),
                ),
              ),
              const Expanded(child: Divider()),
            ],
          ),
          const SizedBox(height: 16),
          // Manual: server URL
          TextField(
            controller: backendUrlController,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(
              labelText: 'Server URL',
              hintText: 'https://admin.example.com',
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.link),
              suffixIcon: backendConfigured
                  ? Icon(Icons.check_circle, color: cs.primary)
                  : null,
            ),
          ),
          const SizedBox(height: 12),
          // Optional: device name override
          TextField(
            controller: deviceNameController,
            decoration: const InputDecoration(
              labelText: 'Device Name (optional)',
              hintText: 'Leave blank to use auto-detected name',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.phone_android),
            ),
          ),
          const SizedBox(height: 12),
          // Manual: registration token
          TextField(
            controller: tokenController,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Registration Token',
              hintText: 'Paste token from admin panel',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.vpn_key),
              alignLabelWithHint: true,
            ),
          ),
          if (lastError != null) ...[
            const SizedBox(height: 8),
            Text(lastError!, style: TextStyle(color: cs.error, fontSize: 12)),
          ],
          const SizedBox(height: 20),
          // Manual submit: verify URL then register
          OutlinedButton(
            onPressed: _busy
                ? null
                : backendConfigured
                ? onRegister
                : onSaveUrl,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 52),
            ),
            child: _busy
                ? const _LoadingIndicator()
                : Text(
                    backendConfigured ? 'Register & Start' : 'Verify & Connect',
                  ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen — main dashboard
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
    required this.accessibilityEnabled,
    required this.isPoweredOn,
    required this.onTogglePower,
    required this.onRunNow,
    required this.onOpenSettings,
    required this.onReloadSubscription,
    this.subscriptionInfo,
  });

  final AgentConfig? config;
  final String status;
  final String? currentJobId;
  final String? lastError;
  final bool processing;
  final List<String> logs;
  final bool phoneGranted;
  final bool smsGranted;
  final bool accessibilityEnabled;
  final bool isPoweredOn;
  final SubscriptionInfo? subscriptionInfo;
  final Future<void> Function() onTogglePower;
  final Future<void> Function() onRunNow;
  final Future<void> Function() onOpenSettings;
  final Future<void> Function() onReloadSubscription;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;

  bool get _allReady =>
      widget.phoneGranted && widget.smsGranted && widget.accessibilityEnabled;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7F6),
      appBar: _buildAppBar(cs),
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
            accessibilityEnabled: widget.accessibilityEnabled,
            isPoweredOn: widget.isPoweredOn,
            subscriptionInfo: widget.subscriptionInfo,
            allReady: _allReady,
            onTogglePower: widget.onTogglePower,
            onRunNow: widget.onRunNow,
            onOpenSettings: widget.onOpenSettings,
            onReloadSubscription: widget.onReloadSubscription,
          ),
          _ActivityTab(logs: widget.logs),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        backgroundColor: cs.surface,
        elevation: 0,
        indicatorColor: const Color(0xFF1B6B4D).withOpacity(0.12),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded, color: Color(0xFF1B6B4D)),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: widget.logs.isNotEmpty,
              label: Text(
                widget.logs.length > 99 ? '99+' : '${widget.logs.length}',
              ),
              child: const Icon(Icons.history_outlined),
            ),
            selectedIcon: const Icon(Icons.history_rounded, color: Color(0xFF1B6B4D)),
            label: 'Activity',
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(ColorScheme cs) {
    final appName = widget.subscriptionInfo?.appName ?? 'dRecharge';
    return PreferredSize(
      preferredSize: const Size.fromHeight(kToolbarHeight),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF134235), Color(0xFF1B6B4D)],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
        ),
        child: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          foregroundColor: Colors.white,
          title: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.30)),
                ),
                child: const Icon(Icons.bolt_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    appName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    'Agent',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.70),
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            _PowerButton(
              isPoweredOn: widget.isPoweredOn,
              onToggle: widget.onTogglePower,
            ),
            IconButton(
              icon: const Icon(Icons.settings_outlined, size: 20, color: Colors.white),
              tooltip: 'Settings',
              onPressed: widget.onOpenSettings,
            ),
            const SizedBox(width: 4),
          ],
        ),
      ),
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Tab — Home
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
    required this.accessibilityEnabled,
    required this.isPoweredOn,
    required this.subscriptionInfo,
    required this.allReady,
    required this.onTogglePower,
    required this.onRunNow,
    required this.onOpenSettings,
    required this.onReloadSubscription,
  });

  final AgentConfig? config;
  final String status;
  final String? currentJobId;
  final String? lastError;
  final bool processing;
  final List<String> logs;
  final bool phoneGranted;
  final bool smsGranted;
  final bool accessibilityEnabled;
  final bool isPoweredOn;
  final SubscriptionInfo? subscriptionInfo;
  final bool allReady;
  final Future<void> Function() onTogglePower;
  final Future<void> Function() onRunNow;
  final Future<void> Function() onOpenSettings;
  final Future<void> Function() onReloadSubscription;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Top licence banner ─────────────────────────────────────────
        _LicenseBanner(info: subscriptionInfo),

        // ── Scrollable body ────────────────────────────────────────────
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              // ── Licence card ──────────────────────────────────────────
              _SubscriptionCard(info: subscriptionInfo, onReload: onReloadSubscription),
              const SizedBox(height: 14),

              // ── Recent activity ───────────────────────────────────────
              _RecentActivityPreview(logs: logs),
            ],
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Tab — full log
// ─────────────────────────────────────────────────────────────────────────────

class _ActivityTab extends StatelessWidget {
  const _ActivityTab({required this.logs});
  final List<String> logs;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Column(
      children: [
        // ── Header ────────────────────────────────────────────────────
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          child: Row(
            children: [
              const Icon(Icons.history_rounded, size: 18, color: Color(0xFF134235)),
              const SizedBox(width: 8),
              const Text(
                'Activity Log',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF134235),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEBF3EE),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${logs.length} event${logs.length == 1 ? '' : 's'}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1B6B4D),
                  ),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),

        // ── Log list ──────────────────────────────────────────────────
        Expanded(
          child: logs.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.inbox_rounded, size: 48, color: cs.outlineVariant),
                      const SizedBox(height: 12),
                      Text(
                        'No activity yet',
                        style: TextStyle(color: cs.outline, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Events will appear here as the agent runs.',
                        style: TextStyle(color: cs.outlineVariant, fontSize: 12),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: logs.length,
                  separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
                  itemBuilder: (context, index) {
                    final entry = logs[index];
                    final isNew = index == 0;
                    final isError = entry.toLowerCase().contains('error') ||
                        entry.toLowerCase().contains('fail');
                    final isSuccess = entry.toLowerCase().contains('success') ||
                        entry.toLowerCase().contains('complet') ||
                        entry.toLowerCase().contains('delivered');

                    final dotColor = isError
                        ? const Color(0xFFDC2626)
                        : isSuccess
                        ? const Color(0xFF1B6B4D)
                        : const Color(0xFF94A3B8);

                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Timeline dot
                          Column(
                            children: [
                              const SizedBox(height: 3),
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: dotColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              entry,
                              style: TextStyle(
                                fontSize: 12,
                                fontFamily: 'monospace',
                                fontWeight: isNew ? FontWeight.w600 : FontWeight.normal,
                                color: isError
                                    ? const Color(0xFFDC2626)
                                    : isNew
                                    ? const Color(0xFF1B6B4D)
                                    : cs.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Actions Row
// ─────────────────────────────────────────────────────────────────────────────

class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow({
    required this.isPoweredOn,
    required this.processing,
    required this.allReady,
    required this.onTogglePower,
    required this.onRunNow,
  });

  final bool isPoweredOn;
  final bool processing;
  final bool allReady;
  final Future<void> Function() onTogglePower;
  final Future<void> Function() onRunNow;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Power toggle chip
        Expanded(
          child: _ActionChip(
            icon: Icons.power_settings_new_rounded,
            label: isPoweredOn ? 'Running' : 'Paused',
            color: isPoweredOn ? const Color(0xFF1B6B4D) : const Color(0xFF94A3B8),
            bg: isPoweredOn ? const Color(0xFFEBF3EE) : const Color(0xFFF1F5F9),
            onTap: onTogglePower,
          ),
        ),
        const SizedBox(width: 8),
        // Run now chip
        Expanded(
          child: _ActionChip(
            icon: processing ? Icons.sync_rounded : Icons.play_circle_outline_rounded,
            label: processing ? 'Processing…' : 'Run Now',
            color: const Color(0xFF1B6B4D),
            bg: const Color(0xFFEBF3EE),
            onTap: (processing || !allReady || !isPoweredOn) ? null : onRunNow,
            loading: processing,
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
    required this.color,
    required this.bg,
    this.onTap,
    this.loading = false,
  });

  final IconData icon;
  final String label;
  final Color color;
  final Color bg;
  final Future<void> Function()? onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        decoration: BoxDecoration(
          color: disabled ? const Color(0xFFF1F5F9) : bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: disabled ? const Color(0xFFE2E8F0) : color.withOpacity(0.25),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            loading
                ? SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: color,
                    ),
                  )
                : Icon(icon, size: 16, color: disabled ? const Color(0xFF94A3B8) : color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: disabled ? const Color(0xFF94A3B8) : color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Banner
// ─────────────────────────────────────────────────────────────────────────────

class _AlertBanner extends StatelessWidget {
  const _AlertBanner({
    required this.icon,
    required this.color,
    required this.bg,
    required this.border,
    required this.message,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final Color bg;
  final Color border;
  final String message;
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: border),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 16, color: color),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Activity Preview (home tab)
// ─────────────────────────────────────────────────────────────────────────────

class _RecentActivityPreview extends StatelessWidget {
  const _RecentActivityPreview({required this.logs});
  final List<String> logs;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final preview = logs.take(5).toList();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EDEB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                const Icon(Icons.history_rounded, size: 15, color: Color(0xFF6B9E89)),
                const SizedBox(width: 6),
                const Text(
                  'Recent Activity',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF134235),
                    letterSpacing: 0.2,
                  ),
                ),
                const Spacer(),
                if (logs.isNotEmpty)
                  Text(
                    '${logs.length} total',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF6B9E89),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (preview.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Center(
                child: Text(
                  'No activity yet',
                  style: TextStyle(fontSize: 12, color: cs.outlineVariant),
                ),
              ),
            )
          else
            ...preview.asMap().entries.map((e) {
              final isError = e.value.toLowerCase().contains('error') ||
                  e.value.toLowerCase().contains('fail');
              final isSuccess = e.value.toLowerCase().contains('success') ||
                  e.value.toLowerCase().contains('complet') ||
                  e.value.toLowerCase().contains('delivered');
              final dotColor = isError
                  ? const Color(0xFFDC2626)
                  : isSuccess
                  ? const Color(0xFF1B6B4D)
                  : const Color(0xFFCBD5E1);

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: dotColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        e.value,
                        style: TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: isError
                              ? const Color(0xFFDC2626)
                              : e.key == 0
                              ? const Color(0xFF1B6B4D)
                              : cs.onSurfaceVariant,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _StatusHeroCard extends StatelessWidget {
  const _StatusHeroCard({
    required this.status,
    required this.currentJobId,
    required this.lastError,
    required this.processing,
    required this.registered,
    required this.allReady,
    required this.isPoweredOn,
  });

  final String status;
  final String? currentJobId;
  final String? lastError;
  final bool processing;
  final bool registered;
  final bool allReady;
  final bool isPoweredOn;

  _StatusStyle _style() {
    if (lastError != null) return _StatusStyle(
      icon: Icons.error_outline_rounded,
      color: const Color(0xFFDC2626),
      bg: const Color(0xFFFEF2F2),
      border: const Color(0xFFFECACA),
      label: 'Error',
    );
    if (processing) return _StatusStyle(
      icon: Icons.sync_rounded,
      color: const Color(0xFF1B6B4D),
      bg: const Color(0xFFEBF3EE),
      border: const Color(0xFFC3D9CE),
      label: 'Processing',
    );
    if (!registered) return _StatusStyle(
      icon: Icons.link_off_rounded,
      color: const Color(0xFF64748B),
      bg: const Color(0xFFF8FAFC),
      border: const Color(0xFFE2E8F0),
      label: 'Not registered',
    );
    if (!isPoweredOn) return _StatusStyle(
      icon: Icons.power_off_rounded,
      color: const Color(0xFFE65100),
      bg: const Color(0xFFFFF8E1),
      border: const Color(0xFFFFE082),
      label: 'Paused',
    );
    if (!allReady) return _StatusStyle(
      icon: Icons.warning_amber_rounded,
      color: const Color(0xFFB45309),
      bg: const Color(0xFFFFFBEB),
      border: const Color(0xFFFDE68A),
      label: 'Needs attention',
    );
    return _StatusStyle(
      icon: Icons.check_circle_rounded,
      color: const Color(0xFF1B6B4D),
      bg: const Color(0xFFEBF3EE),
      border: const Color(0xFFC3D9CE),
      label: 'Active',
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _style();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: s.bg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: s.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: s.color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(s.icon, size: 18, color: s.color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: s.color.withOpacity(0.7),
                        letterSpacing: 0.4,
                      ),
                    ),
                    Text(
                      status,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: s.color,
                        height: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
              if (processing)
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: s.color,
                  ),
                ),
            ],
          ),
          if (currentJobId != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: s.color.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.receipt_long_rounded, size: 12, color: s.color),
                  const SizedBox(width: 6),
                  Text(
                    'Job: $currentJobId',
                    style: TextStyle(
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: s.color,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (lastError != null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFDC2626).withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                lastError!,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFFDC2626),
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusStyle {
  const _StatusStyle({
    required this.icon,
    required this.color,
    required this.bg,
    required this.border,
    required this.label,
  });
  final IconData icon;
  final Color color;
  final Color bg;
  final Color border;
  final String label;
}

class _DeviceInfoCard extends StatelessWidget {
  const _DeviceInfoCard({required this.config});
  final AgentConfig config;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EDEB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.phone_android_rounded, size: 14, color: Color(0xFF6B9E89)),
              SizedBox(width: 6),
              Text(
                'Device',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF134235),
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _DeviceInfoCell(
                  label: 'Name',
                  value: config.name,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _DeviceInfoCell(
                  label: 'Device ID',
                  value: config.deviceId.length > 12
                      ? '${config.deviceId.substring(0, 12)}…'
                      : config.deviceId,
                  mono: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DeviceInfoCell extends StatelessWidget {
  const _DeviceInfoCell({required this.label, required this.value, this.mono = false});
  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: Color(0xFF6B9E89),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF134235),
            fontFamily: mono ? 'monospace' : null,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _LicenseBanner — full-width hero banner with logo + app name + status badge
// ─────────────────────────────────────────────────────────────────────────────

class _LicenseBanner extends StatefulWidget {
  const _LicenseBanner({this.info});
  final SubscriptionInfo? info;

  @override
  State<_LicenseBanner> createState() => _LicenseBannerState();
}

class _LicenseBannerState extends State<_LicenseBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;
  bool _imageLoaded = false;
  bool _imageError  = false;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);
  }

  @override
  void didUpdateWidget(_LicenseBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.info?.logoFullUrl != widget.info?.logoFullUrl) {
      setState(() {
        _imageLoaded = false;
        _imageError = false;
      });
      _fadeCtrl.reset();
    }
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _onImageLoaded() {
    if (!mounted || _imageLoaded) return;
    setState(() => _imageLoaded = true);
    _fadeCtrl.forward();
  }

  void _onImageError() {
    if (!mounted) return;
    setState(() => _imageError = true);
  }

  @override
  Widget build(BuildContext context) {
    final info     = widget.info;
    final String?  logoUrl  = info?.logoFullUrl;
    final String   appName  = info?.appName ?? 'dRecharge';

    final bool isBlocked  = info != null &&
        (info.state == 'expired' ||
         info.state == 'inactive' ||
         info.state == 'untracked');
    final bool isExpiring = info?.isExpiring ?? false;
    final bool isActive   = info?.state == 'active';

    // ── Gradient background ────────────────────────────────────────────────
    final List<Color> gradientColors = isBlocked
        ? [const Color(0xFF7F1D1D), const Color(0xFF991B1B)]
        : isExpiring
        ? [const Color(0xFF78350F), const Color(0xFF92400E)]
        : [const Color(0xFF134235), const Color(0xFF1B6B4D)];

    // ── Status badge ──────────────────────────────────────────────────────
    final Color statusColor = isBlocked
        ? const Color(0xFFDC2626)
        : isExpiring
        ? const Color(0xFFD97706)
        : const Color(0xFF16A34A);

    final String statusLabel = info == null
        ? 'Loading…'
        : isBlocked
        ? _blockedLabel(info.state)
        : isExpiring
        ? 'Expiring in ${info.daysUntilExpiry ?? 0}d'
        : 'Active';

    final IconData statusIcon = isBlocked
        ? Icons.error_outline_rounded
        : isExpiring
        ? Icons.warning_amber_rounded
        : Icons.verified_rounded;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradientColors,
        ),
      ),
      child: Stack(
        children: [
          // ── Logo as full-bleed background image ─────────────────────────
          if (logoUrl != null && !_imageError)
            FadeTransition(
              opacity: _fadeAnim,
              child: SizedBox(
                width: double.infinity,
                child: Image.network(
                  logoUrl,
                  fit: BoxFit.fitWidth,
                  frameBuilder: (ctx, child, frame, wasSync) {
                    if (frame != null) {
                      WidgetsBinding.instance
                          .addPostFrameCallback((_) => _onImageLoaded());
                    }
                    return child;
                  },
                  errorBuilder: (_, __, ___) {
                    WidgetsBinding.instance
                        .addPostFrameCallback((_) => _onImageError());
                    return const SizedBox.shrink();
                  },
                ),
              ),
            ),

          // ── Shimmer while logo is loading ────────────────────────────────
          if (logoUrl != null && !_imageLoaded && !_imageError)
            Positioned.fill(
              child: _ShimmerPulse(
                baseColor:      Colors.white.withValues(alpha: 0.04),
                highlightColor: Colors.white.withValues(alpha: 0.13),
              ),
            ),

          // ── Foreground content ────────────────────────────────────────────
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Spacer(),

                  // Status pill — only shown for blocked / expiring states
                  if (!isActive || isExpiring)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.88),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.30),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, size: 11, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            statusLabel,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _blockedLabel(String state) => switch (state) {
    'expired'   => 'Expired',
    'inactive'  => 'Inactive',
    'untracked' => 'Unregistered',
    _           => 'Blocked',
  };
}

// Small logo thumbnail used inside the banner content row
class _LogoThumb extends StatelessWidget {
  const _LogoThumb({this.logoUrl});
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
      ),
      clipBehavior: Clip.antiAlias,
      child: logoUrl != null
          ? Image.network(
              logoUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const _BoltIcon(),
            )
          : const _BoltIcon(),
    );
  }
}

class _BoltIcon extends StatelessWidget {
  const _BoltIcon();
  @override
  Widget build(BuildContext context) => const Icon(
        Icons.bolt_rounded,
        color: Colors.white,
        size: 24,
      );
}

// ── Shimmer pulse animation ───────────────────────────────────────────────────
class _ShimmerPulse extends StatefulWidget {
  const _ShimmerPulse({
    required this.baseColor,
    required this.highlightColor,
  });
  final Color baseColor;
  final Color highlightColor;

  @override
  State<_ShimmerPulse> createState() => _ShimmerPulseState();
}

class _ShimmerPulseState extends State<_ShimmerPulse>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Container(
        color: Color.lerp(
          widget.baseColor,
          widget.highlightColor,
          Curves.easeInOut.transform(_ctrl.value),
        ),
      ),
    );
  }
}





// ─────────────────────────────────────────────────────────────────────────────
// _SubscriptionCard — compact: status + expiry progress bar + reload
// ─────────────────────────────────────────────────────────────────────────────


class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({this.info, required this.onReload});
  final SubscriptionInfo? info;
  final Future<void> Function() onReload;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    // Loading skeleton
    if (info == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: cs.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: cs.outlineVariant),
        ),
        child: Row(
          children: [
            Icon(Icons.shield_outlined, size: 18, color: cs.outline),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Checking licence…',
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: cs.outline),
              ),
            ),
            _ReloadButton(onReload: onReload),
          ],
        ),
      );
    }

    final String state    = info!.state;
    final bool isActive   = state == 'active';
    final bool isExpiring = info!.isExpiring;
    final bool isBlocked  = state == 'expired' || state == 'inactive' || state == 'untracked';

    final Color statusColor = isBlocked
        ? const Color(0xFFDC2626)
        : isExpiring
        ? const Color(0xFFD97706)
        : const Color(0xFF1B6B4D);

    final String statusLabel = switch (state) {
      'active'    => isExpiring ? 'Expiring Soon' : 'Active',
      'expired'   => 'Expired',
      'inactive'  => 'Inactive',
      'untracked' => 'Unregistered',
      _           => 'Unknown',
    };

    // Expiry progress bar (days remaining / 365)
    final double barFraction = (isActive || isExpiring) && info!.daysUntilExpiry != null
        ? (info!.daysUntilExpiry! / 365.0).clamp(0.0, 1.0)
        : 0.0;

    final Color cardBg = isBlocked
        ? const Color(0xFFFFF5F5)
        : isExpiring
        ? const Color(0xFFFFFBEB)
        : cs.surfaceContainerLow;

    final Color cardBorder = isBlocked
        ? const Color(0xFFFECACA)
        : isExpiring
        ? const Color(0xFFFDE68A)
        : cs.outlineVariant;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Top row: label + status badge + reload ────────────────────
          Row(
            children: [
              Icon(
                isBlocked ? Icons.error_outline_rounded : Icons.shield_outlined,
                size: 16,
                color: statusColor,
              ),
              const SizedBox(width: 8),
              Text(
                'Licence',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: statusColor.withOpacity(0.7),
                  letterSpacing: 0.3,
                ),
              ),
              const Spacer(),
              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withOpacity(0.3)),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _ReloadButton(onReload: onReload),
            ],
          ),

          // ── Expiry label + days ───────────────────────────────────────
          if (info!.expiresAt != null) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isBlocked ? 'Expired on' : 'Expires on',
                  style: TextStyle(
                    fontSize: 11,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                Text(
                  _formatDate(info!.expiresAt!),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ],
            ),
          ],

          // ── Progress bar ──────────────────────────────────────────────
          if (barFraction > 0) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: barFraction,
                minHeight: 6,
                backgroundColor: cs.outlineVariant.withOpacity(0.35),
                valueColor: AlwaysStoppedAnimation<Color>(statusColor),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              info!.daysUntilExpiry != null
                  ? '${info!.daysUntilExpiry} days remaining'
                  : '',
              style: TextStyle(
                fontSize: 10,
                color: statusColor.withOpacity(0.75),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _formatDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}';
  }

  static Future<void> _launchUrl(Uri uri) async {
    const platform = MethodChannel('drecharge_agent/native');
    try {
      await platform.invokeMethod('openUrl', {'url': uri.toString()});
    } catch (_) {}
  }
}

class _ReloadButton extends StatefulWidget {
  const _ReloadButton({required this.onReload});
  final Future<void> Function() onReload;

  @override
  State<_ReloadButton> createState() => _ReloadButtonState();
}

class _ReloadButtonState extends State<_ReloadButton>
    with SingleTickerProviderStateMixin {
  bool _loading = false;
  late final AnimationController _spinCtrl;

  @override
  void initState() {
    super.initState();
    _spinCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
  }

  @override
  void dispose() {
    _spinCtrl.dispose();
    super.dispose();
  }

  Future<void> _tap() async {
    if (_loading) return;
    setState(() => _loading = true);
    _spinCtrl.repeat();
    try {
      await widget.onReload();
    } finally {
      if (mounted) {
        _spinCtrl.stop();
        _spinCtrl.reset();
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: _tap,
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: RotationTransition(
          turns: _spinCtrl,
          child: Icon(
            Icons.refresh_rounded,
            size: 16,
            color: _loading ? cs.primary : cs.outline,
          ),
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.on, required this.label});
  final bool on;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = on ? const Color(0xFF1B6B4D) : const Color(0xFFDC2626);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

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
    return Row(
      children: [
        Icon(icon, size: 16, color: cs.outline),
        const SizedBox(width: 8),
        Text(
          '$label  ',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: cs.outline),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontFamily: mono ? 'monospace' : null,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}


// ── Power Button — shown in the AppBar ───────────────────────────────────────
class _PowerButton extends StatelessWidget {
  const _PowerButton({required this.isPoweredOn, required this.onToggle});
  final bool isPoweredOn;
  final Future<void> Function() onToggle;

  @override
  Widget build(BuildContext context) {
    // ON → bright green pill; OFF → red pill — both readable on the green AppBar
    final onColor  = const Color(0xFF4ADE80);  // lighter green — pops on dark green bg
    final offColor = const Color(0xFFFCA5A5);  // light red — pops on dark green bg
    return Tooltip(
      message: isPoweredOn ? 'Power OFF' : 'Power ON',
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onToggle,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.power_settings_new_rounded,
                size: 15,
                color: isPoweredOn ? onColor : offColor,
              ),
              const SizedBox(width: 5),
              Text(
                isPoweredOn ? 'ON' : 'OFF',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: isPoweredOn ? onColor : offColor,
                  letterSpacing: 0.5,
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
// SettingsPage — backend URL, permissions, device registration
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
    required this.accessibilityEnabled,
    required this.lastError,
    required this.onSaveUrl,
    required this.onResetUrl,
    required this.onScanQr,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
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
  final bool accessibilityEnabled;
  final String? lastError;
  final Future<void> Function() onSaveUrl;
  final Future<void> Function() onResetUrl;
  final Future<void> Function() onScanQr;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onRegister;
  final Future<void> Function() onResetDevice;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final registered = config != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings'), elevation: 0),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Permissions section ─────────────────────────────────────────
          _SectionHeader(title: 'Permissions'),
          Card(
            elevation: 0,
            color: cs.surfaceContainerLow,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: cs.outlineVariant),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _PermissionTile(
                    icon: Icons.phone,
                    title: 'Phone & Calls',
                    subtitle: 'CALL_PHONE + READ_PHONE_STATE',
                    granted: phoneGranted,
                  ),
                  const SizedBox(height: 10),
                  _PermissionTile(
                    icon: Icons.sms,
                    title: 'SMS Read',
                    subtitle: 'READ_SMS',
                    granted: smsGranted,
                  ),
                  const SizedBox(height: 10),
                  _PermissionTile(
                    icon: Icons.accessibility_new,
                    title: 'Accessibility Service',
                    subtitle: 'Auto-fill USSD dialogs',
                    granted: accessibilityEnabled,
                  ),
                  const SizedBox(height: 16),
                  if (!phoneGranted || !smsGranted)
                    OutlinedButton.icon(
                      onPressed: onRequestPermissions,
                      icon: const Icon(Icons.security),
                      label: const Text('Grant Permissions'),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 48),
                      ),
                    ),
                  if (!accessibilityEnabled) ...[
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: onOpenAccessibility,
                      icon: const Icon(Icons.accessibility_new),
                      label: const Text('Open Accessibility Settings'),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 48),
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),
                  const Divider(),
                  const SizedBox(height: 12),
                  Text(
                    'System Restrictions',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: cs.primary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => NativeBridge().openAppInfo(),
                    icon: const Icon(Icons.lock_open_rounded, size: 18),
                    label: const Text('Allow Restricted Settings (Android 13+)'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 44),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => NativeBridge().openBatterySettings(),
                    icon: const Icon(Icons.battery_charging_full_rounded, size: 18),
                    label: const Text('Exclude from Battery Saver'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 44),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // ── Backend section ─────────────────────────────────────────────
          _SectionHeader(title: 'Backend Server'),
          Card(
            elevation: 0,
            color: cs.surfaceContainerLow,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: cs.outlineVariant),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (backendConfigured) ...[
                    Row(
                      children: [
                        Icon(Icons.check_circle, color: cs.primary, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            BackendService.currentBaseUrl,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: cs.onSurfaceVariant,
                                  fontFamily: 'monospace',
                                ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (registered)
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: cs.tertiaryContainer,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline,
                            color: cs.onTertiaryContainer,
                            size: 14,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Changing the backend will unlink this device.',
                              style: TextStyle(
                                color: cs.onTertiaryContainer,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (registered) const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: saving ? null : onScanQr,
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text('Scan QR from Admin Panel'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 48),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: backendUrlController,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Server URL',
                      hintText: 'https://admin.example.com',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.link),
                    ),
                  ),
                  if (lastError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      lastError!,
                      style: TextStyle(color: cs.error, fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: FilledButton(
                          onPressed: saving ? null : onSaveUrl,
                          child: saving
                              ? const _LoadingIndicator()
                              : Text(
                                  backendConfigured
                                      ? 'Update URL'
                                      : 'Verify & Save',
                                ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: OutlinedButton(
                          onPressed: saving ? null : onResetUrl,
                          child: const Text('Reset'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // ── Device Registration ─────────────────────────────────────────
          _SectionHeader(title: registered ? 'Device' : 'Register Device'),
          if (registered)
            Card(
              elevation: 0,
              color: cs.surfaceContainerLow,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _InfoRow(
                      icon: Icons.phone_android,
                      label: 'Name',
                      value: config!.name,
                    ),
                    const SizedBox(height: 8),
                    _InfoRow(
                      icon: Icons.fingerprint,
                      label: 'ID',
                      value: config!.deviceId,
                      mono: true,
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: onResetDevice,
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Unlink Device'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: cs.error,
                        side: BorderSide(color: cs.error),
                        minimumSize: const Size(double.infinity, 48),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else if (backendConfigured)
            Card(
              elevation: 0,
              color: cs.surfaceContainerLow,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // Primary: scan QR for one-shot registration
                    FilledButton.icon(
                      onPressed: registering ? null : onScanQr,
                      icon: const Icon(Icons.qr_code_scanner),
                      label: const Text('Scan QR to Register'),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(double.infinity, 48),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'or enter manually',
                            style: TextStyle(color: cs.outline, fontSize: 12),
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: deviceNameController,
                      decoration: const InputDecoration(
                        labelText: 'Device Name (optional)',
                        hintText: 'Leave blank to use auto-detected name',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.phone_android),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: tokenController,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Registration Token',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.vpn_key),
                        alignLabelWithHint: true,
                      ),
                    ),
                    if (lastError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        lastError!,
                        style: TextStyle(color: cs.error, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: registering ? null : onRegister,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(double.infinity, 48),
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
            Card(
              elevation: 0,
              color: cs.surfaceContainerLow,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Configure the backend server first, then register this device.',
                  style: TextStyle(color: cs.outline),
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
// Shared widgets
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 10),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          letterSpacing: 1.2,
          color: Theme.of(context).colorScheme.outline,
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
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: granted ? cs.primaryContainer : cs.errorContainer,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            icon,
            size: 20,
            color: granted ? cs.primary : cs.onErrorContainer,
          ),
        ),
        const SizedBox(width: 14),
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
                subtitle,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
              ),
            ],
          ),
        ),
        Icon(
          granted ? Icons.check_circle_rounded : Icons.cancel_rounded,
          color: granted ? cs.primary : cs.error,
          size: 22,
        ),
      ],
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
// QR Scanner page (unchanged)
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Admin QR Code'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
            tooltip: 'Toggle torch',
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const Positioned(
            bottom: 48,
            left: 0,
            right: 0,
            child: Text(
              'Point at the QR code on your admin panel',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
