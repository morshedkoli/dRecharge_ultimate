/// dRecharge Agent — redesigned UI/UX
/// Navigation:
///   SetupScreen  → first-run wizard (permissions + backend + register)
///   HomeScreen   → clean status dashboard (the main screen)
///   SettingsPage → backend URL, permissions, device registration / reset

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

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

class _AppShellState extends State<_AppShell> {
  final _nativeBridge = NativeBridge();
  final _backendUrlController = TextEditingController();
  final _tokenController = TextEditingController();
  final _nameController = TextEditingController();
  final _simProviderController = TextEditingController();

  AgentConfig? _config;
  bool _backendConfigured = false;
  bool _loading = true;
  bool _registering = false;
  bool _savingBackendUrl = false;
  bool _processing = false;
  bool _phonePermissionGranted = false;
  bool _smsPermissionGranted = false;
  bool _accessibilityEnabled = false;
  String _status = 'Idle';
  String? _currentJobId;
  String? _lastError;
  final List<String> _logs = <String>[];
  Timer? _pollTimer;
  Timer? _heartbeatTimer;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _heartbeatTimer?.cancel();
    _backendUrlController.dispose();
    _tokenController.dispose();
    _nameController.dispose();
    _simProviderController.dispose();
    super.dispose();
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────

  Future<void> _bootstrap() async {
    try {
      _backendUrlController.text = await BackendService.getConfiguredBaseUrl();
      final storedBaseUrl = await BackendService.hasStoredBaseUrl();
      final savedConfig = await BackendService.loadConfig();
      final authenticated = await BackendService.isAuthenticated;

      _backendConfigured = storedBaseUrl;

      if (savedConfig != null && authenticated) {
        if (!storedBaseUrl) {
          await BackendService.saveBaseUrl(BackendService.currentBaseUrl);
          _backendConfigured = true;
        }
        _config = savedConfig;
        _startLoops();
      } else if (savedConfig != null && !authenticated) {
        await BackendService.clearConfig();
      }

      _nameController.text =
          _config?.name.isNotEmpty == true ? _config!.name : 'Agent Device';
      _simProviderController.text =
          _config?.simProvider.isNotEmpty == true ? _config!.simProvider : 'SIM 1';

      await _refreshCapabilities();
    } catch (error) {
      _lastError = error.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Capabilities ─────────────────────────────────────────────────────────

  Future<void> _refreshCapabilities() async {
    final phoneStatus = await Permission.phone.status;
    final smsStatus = await Permission.sms.status;
    final accessibilityEnabled = await _nativeBridge.isAccessibilityEnabled();
    if (!mounted) return;
    setState(() {
      _phonePermissionGranted = phoneStatus.isGranted;
      _smsPermissionGranted = smsStatus.isGranted;
      _accessibilityEnabled = accessibilityEnabled;
    });
  }

  Future<void> _requestPermissions() async {
    await <Permission>[
      Permission.phone,
      Permission.sms,
    ].request();
    await _refreshCapabilities();
  }

  bool get _allPermissionsOk =>
      _phonePermissionGranted && _smsPermissionGranted && _accessibilityEnabled;

  // ── Backend URL ──────────────────────────────────────────────────────────

  Future<void> _saveBackendUrl() async {
    final rawUrl = _backendUrlController.text.trim();
    final parsed = Uri.tryParse(rawUrl);
    final isValid = parsed != null &&
        parsed.hasScheme &&
        (parsed.scheme == 'http' || parsed.scheme == 'https') &&
        parsed.host.isNotEmpty;

    if (!isValid) {
      setState(() => _lastError = 'Backend URL must be a valid http(s) URL.');
      return;
    }

    final wasRegistered = _config != null;
    final preservedName = _nameController.text;
    final preservedSimProvider = _simProviderController.text;

    setState(() {
      _savingBackendUrl = true;
      _lastError = null;
    });

    try {
      final bootstrap = await BackendService.testBaseUrl(rawUrl);
      if (bootstrap['success'] != true) throw Exception('Endpoint validation failed.');

      final resolvedBaseUrl = (bootstrap['baseUrl'] as String?)?.trim();
      await BackendService.saveBaseUrl(
        resolvedBaseUrl != null && resolvedBaseUrl.isNotEmpty ? resolvedBaseUrl : rawUrl,
      );

      if (wasRegistered) {
        _pollTimer?.cancel();
        _heartbeatTimer?.cancel();
        await BackendService.clearConfig();
      }

      if (!mounted) return;

      _nameController.text = preservedName;
      _simProviderController.text = preservedSimProvider;
      _tokenController.clear();

      setState(() {
        _backendConfigured = true;
        _config = null;
        _currentJobId = null;
        _status = wasRegistered ? 'Backend updated — register again' : 'Endpoint verified';
        if (wasRegistered) {
          _lastError = 'Backend changed. Re-register this device on the new server.';
        }
      });
      _appendLog('Backend URL set to ${BackendService.currentBaseUrl}.');
    } catch (error) {
      if (!mounted) return;
      setState(() => _lastError = 'Failed to save backend URL: $error');
    } finally {
      if (mounted) setState(() => _savingBackendUrl = false);
    }
  }

  Future<void> _resetBackendUrl() async {
    final wasRegistered = _config != null;
    final preservedName = _nameController.text;
    final preservedSimProvider = _simProviderController.text;
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
      }
      if (!mounted) return;
      _backendUrlController.text = BackendService.currentBaseUrl;
      _nameController.text = preservedName;
      _simProviderController.text = preservedSimProvider;
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

  Future<void> _registerDevice() async {
    if (_registering) return;
    if (_tokenController.text.trim().isEmpty ||
        _nameController.text.trim().isEmpty ||
        _simProviderController.text.trim().isEmpty) {
      setState(() => _lastError = 'Token, device name, and SIM label are required.');
      return;
    }
    setState(() {
      _registering = true;
      _lastError = null;
      _status = 'Registering device';
    });
    try {
      final deviceId = await BackendService.registerDevice(
        registrationToken: _tokenController.text.trim(),
        deviceName: _nameController.text.trim(),
        simProvider: _simProviderController.text.trim(),
      );
      if (!mounted) return;
      _config = AgentConfig(
        deviceId: deviceId,
        name: _nameController.text.trim(),
        simProvider: _simProviderController.text.trim(),
      );
      setState(() {
        _tokenController.clear();
        _status = 'Device registered';
      });
      _appendLog('Device $deviceId registered.');
      _startLoops();
      await _refreshCapabilities();
      await _sendHeartbeat();
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
    if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
      await _saveBackendUrl();
    }
  }

  // ── Worker loops ─────────────────────────────────────────────────────────

  void _startLoops() {
    _pollTimer?.cancel();
    _heartbeatTimer?.cancel();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_runQueueTick()),
    );
    _heartbeatTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => unawaited(_sendHeartbeat()),
    );
    unawaited(_runQueueTick());
    unawaited(_sendHeartbeat());
  }

  Future<void> _sendHeartbeat() async {
    if (_config == null) return;
    try {
      await BackendService.sendHeartbeat(
        currentJob: _currentJobId,
        simProvider: _config?.simProvider,
        name: _config?.name,
      );
    } catch (error) {
      _appendLog('Heartbeat failed: $error');
    }
  }

  Future<void> _runQueueTick() async {
    final config = _config;
    if (config == null || _processing) return;
    if (!_phonePermissionGranted || !_smsPermissionGranted || !_accessibilityEnabled) {
      if (mounted) setState(() => _status = 'Waiting for permissions/accessibility');
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

      final liveJob = await BackendService.fetchJob(job.jobId) ?? job;
      if (!mounted) return;
      setState(() {
        _currentJobId = liveJob.jobId;
        _status = 'Processing ${liveJob.jobId}';
        _lastError = null;
      });
      _appendLog('Acquired job ${liveJob.jobId} for ${liveJob.recipientNumber}.');
      await _sendHeartbeat();

      final service = await BackendService.fetchService(liveJob.serviceId);
      if (service == null || !service.isActive) {
        await _reportFailure(
          job: liveJob,
          reason: 'Service is missing or inactive.',
          stepsExecuted: const <Map<String, dynamic>>[],
          rawSms: '',
        );
        return;
      }

      final flowSegments = BackendService.resolveUssdFlow(job: liveJob, service: service);
      if (flowSegments.isEmpty) {
        await _reportFailure(
          job: liveJob,
          reason: 'Resolved USSD flow is empty.',
          stepsExecuted: const <Map<String, dynamic>>[],
          rawSms: '',
        );
        return;
      }

      _appendLog('Executing flow: ${flowSegments.join(' -> ')}');
      final startedAtMs = DateTime.now().millisecondsSinceEpoch;
      List<Map<String, dynamic>> stepsExecuted;
      try {
        stepsExecuted = await _nativeBridge.executeUssdFlow(
          flowSegments: flowSegments,
          simSlot: service.simSlot,
        );
      } catch (error) {
        await _reportFailure(
          job: liveJob,
          reason: 'USSD execution failed: $error',
          stepsExecuted: const <Map<String, dynamic>>[],
          rawSms: '',
        );
        return;
      }

      final matchedSms = await _waitForConfirmationSms(
        sinceMs: startedAtMs,
        job: liveJob,
        service: service,
      );

      final rawSms = matchedSms?.body ?? '';
      final parsedResult = matchedSms == null
          ? <String, dynamic>{
              'success': false,
              'reason': 'No confirmation SMS received within ${service.smsTimeout}s',
            }
          : <String, dynamic>{
              'success': false,
              'reason': 'SMS captured, awaiting server-side template validation',
            };

      await BackendService.reportJobResult(
        jobId: liveJob.jobId,
        txId: liveJob.txId,
        rawSms: rawSms,
        isSuccess: false,
        parsedResult: parsedResult,
        ussdStepsExecuted: stepsExecuted,
      );
      _appendLog(
        matchedSms == null
            ? 'Job ${liveJob.jobId} reported without SMS.'
            : 'Job ${liveJob.jobId} reported with SMS from ${matchedSms.address}.',
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
      if (mounted) setState(() {
        _lastError = error.toString();
        _status = 'Error';
      });
    } finally {
      _processing = false;
      _currentJobId = null;
      await _sendHeartbeat();
      if (mounted && _status.startsWith('Processing')) setState(() => _status = 'Idle');
    }
  }

  Future<SmsEntry?> _waitForConfirmationSms({
    required int sinceMs,
    required ExecutionJob job,
    required ServiceConfig service,
  }) async {
    final deadline = DateTime.now().add(Duration(seconds: service.smsTimeout));
    while (DateTime.now().isBefore(deadline)) {
      final messages = await _nativeBridge.readRecentSms(sinceMs: sinceMs, maxMessages: 12);
      final picked = BackendService.pickConfirmationSms(
        messages: messages,
        job: job,
        service: service,
      );
      if (picked != null) return picked;
      await Future<void>.delayed(const Duration(seconds: 4));
    }
    return null;
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
      rawSms: rawSms,
      isSuccess: false,
      parsedResult: <String, dynamic>{'success': false, 'reason': reason},
      ussdStepsExecuted: stepsExecuted,
    );
    _appendLog('Job ${job.jobId} failed: $reason');
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
    if (!mounted) return;
    setState(() {
      _config = null;
      _currentJobId = null;
      _status = 'Idle';
      _lastError = null;
      _logs.clear();
    });
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // First-time setup: no backend configured → show setup wizard
    final bool setupComplete = _backendConfigured && _allPermissionsOk;
    if (!setupComplete && _config == null && !_backendConfigured) {
      return SetupScreen(
        backendUrlController: _backendUrlController,
        tokenController: _tokenController,
        nameController: _nameController,
        simProviderController: _simProviderController,
        saving: _savingBackendUrl,
        registering: _registering,
        phoneGranted: _phonePermissionGranted,
        smsGranted: _smsPermissionGranted,
        accessibilityEnabled: _accessibilityEnabled,
        onSaveUrl: _saveBackendUrl,
        onScanQr: _scanQrCode,
        onRequestPermissions: _requestPermissions,
        onOpenAccessibility: _nativeBridge.openAccessibilitySettings,
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
      onRunNow: _runQueueTick,
      onOpenSettings: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => SettingsPage(
              backendUrlController: _backendUrlController,
              tokenController: _tokenController,
              nameController: _nameController,
              simProviderController: _simProviderController,
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
// SetupScreen — first-run wizard (3 steps)
// ─────────────────────────────────────────────────────────────────────────────

class SetupScreen extends StatefulWidget {
  const SetupScreen({
    super.key,
    required this.backendUrlController,
    required this.tokenController,
    required this.nameController,
    required this.simProviderController,
    required this.saving,
    required this.registering,
    required this.phoneGranted,
    required this.smsGranted,
    required this.accessibilityEnabled,
    required this.onSaveUrl,
    required this.onScanQr,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onRegister,
    required this.lastError,
    required this.backendConfigured,
  });

  final TextEditingController backendUrlController;
  final TextEditingController tokenController;
  final TextEditingController nameController;
  final TextEditingController simProviderController;
  final bool saving;
  final bool registering;
  final bool phoneGranted;
  final bool smsGranted;
  final bool accessibilityEnabled;
  final Future<void> Function() onSaveUrl;
  final Future<void> Function() onScanQr;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
  final Future<void> Function() onRegister;
  final String? lastError;
  final bool backendConfigured;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<String> _pageTitles = [
    'Permissions',
    'Backend Server',
    'Register Device',
  ];

  void _goNext() {
    if (_currentPage < 2) {
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
                        child: Icon(Icons.bolt_rounded, color: cs.primary, size: 26),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('dRecharge Agent',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                          Text('Device Setup',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: cs.outline)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  // Step indicator
                  Row(
                    children: List.generate(3, (i) {
                      final active = i == _currentPage;
                      final done = i < _currentPage;
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(right: i < 2 ? 6 : 0),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 250),
                            height: 5,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: done || active ? cs.primary : cs.surfaceContainerHighest,
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Step ${_currentPage + 1} of 3 — ${_pageTitles[_currentPage]}',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: cs.outline),
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
                    onRequestPermissions: widget.onRequestPermissions,
                    onOpenAccessibility: widget.onOpenAccessibility,
                    onNext: _goNext,
                  ),
                  // Step 2: Backend
                  _SetupBackendStep(
                    controller: widget.backendUrlController,
                    saving: widget.saving,
                    configured: widget.backendConfigured,
                    lastError: widget.lastError,
                    onSave: widget.onSaveUrl,
                    onScanQr: widget.onScanQr,
                    onNext: _goNext,
                  ),
                  // Step 3: Register
                  _SetupRegisterStep(
                    tokenController: widget.tokenController,
                    nameController: widget.nameController,
                    simProviderController: widget.simProviderController,
                    registering: widget.registering,
                    lastError: widget.lastError,
                    onRegister: widget.onRegister,
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
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
    required this.onNext,
  });

  final bool phoneGranted;
  final bool smsGranted;
  final bool accessibilityEnabled;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;
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
          Text('Required Permissions',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(
            'The agent needs these permissions to automatically execute USSD requests.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
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
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onOpenAccessibility,
              icon: const Icon(Icons.accessibility_new),
              label: const Text('Open Accessibility Settings'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
          ],
          if (_allOk) ...[
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

class _SetupBackendStep extends StatelessWidget {
  const _SetupBackendStep({
    required this.controller,
    required this.saving,
    required this.configured,
    required this.lastError,
    required this.onSave,
    required this.onScanQr,
    required this.onNext,
  });

  final TextEditingController controller;
  final bool saving;
  final bool configured;
  final String? lastError;
  final Future<void> Function() onSave;
  final Future<void> Function() onScanQr;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Text('Connect to Server',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(
            'Scan the QR code from the admin panel, or enter the server URL manually.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 28),
          // QR button
          OutlinedButton.icon(
            onPressed: saving ? null : onScanQr,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan Admin QR Code'),
            style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 52)),
          ),
          const SizedBox(height: 16),
          Row(children: [
            const Expanded(child: Divider()),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text('or', style: TextStyle(color: cs.outline)),
            ),
            const Expanded(child: Divider()),
          ]),
          const SizedBox(height: 16),
          TextField(
            controller: controller,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(
              labelText: 'Server URL',
              hintText: 'https://admin.example.com',
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.link),
              suffixIcon: configured
                  ? Icon(Icons.check_circle, color: cs.primary)
                  : null,
            ),
          ),
          if (lastError != null && !configured) ...[
            const SizedBox(height: 8),
            Text(lastError!, style: TextStyle(color: cs.error, fontSize: 12)),
          ],
          const Spacer(),
          FilledButton(
            onPressed: saving
                ? null
                : configured
                    ? onNext
                    : onSave,
            style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 52)),
            child: saving
                ? const _LoadingIndicator()
                : Text(configured ? 'Continue →' : 'Verify & Connect'),
          ),
        ],
      ),
    );
  }
}

class _SetupRegisterStep extends StatelessWidget {
  const _SetupRegisterStep({
    required this.tokenController,
    required this.nameController,
    required this.simProviderController,
    required this.registering,
    required this.lastError,
    required this.onRegister,
  });

  final TextEditingController tokenController;
  final TextEditingController nameController;
  final TextEditingController simProviderController;
  final bool registering;
  final String? lastError;
  final Future<void> Function() onRegister;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 12),
          Text('Register Device',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(
            'Enter the registration token from the admin panel to link this device.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Device Name',
              hintText: 'e.g. Agent Phone 1',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.phone_android),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: simProviderController,
            decoration: const InputDecoration(
              labelText: 'SIM Label',
              hintText: 'e.g. SIM 1',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.sim_card),
            ),
          ),
          const SizedBox(height: 16),
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
          const Spacer(),
          FilledButton(
            onPressed: registering ? null : onRegister,
            style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 52)),
            child: registering
                ? const _LoadingIndicator()
                : const Text('Register & Start'),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen — main dashboard
// ─────────────────────────────────────────────────────────────────────────────

class HomeScreen extends StatelessWidget {
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
    required this.onRunNow,
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
  final bool accessibilityEnabled;
  final Future<void> Function() onRunNow;
  final Future<void> Function() onOpenSettings;

  bool get _allReady => phoneGranted && smsGranted && accessibilityEnabled;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final registered = config != null;

    return Scaffold(
      backgroundColor: cs.surface,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: cs.primaryContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.bolt_rounded, color: cs.primary, size: 18),
            ),
            const SizedBox(width: 10),
            const Text('dRecharge Agent'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings',
            onPressed: onOpenSettings,
          ),
        ],
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Status hero card ────────────────────────────────────────────
          _StatusHeroCard(
            status: status,
            currentJobId: currentJobId,
            lastError: lastError,
            processing: processing,
            registered: registered,
            allReady: _allReady,
          ),
          const SizedBox(height: 16),

          // ── Permission warning banner (if not ready) ────────────────────
          if (!_allReady)
            _WarningBanner(
              message: 'Some permissions are missing. Tap Settings to fix.',
              onTap: onOpenSettings,
            ),
          if (!_allReady) const SizedBox(height: 16),

          // ── Device info card ────────────────────────────────────────────
          if (registered) ...[
            _DeviceInfoCard(config: config!),
            const SizedBox(height: 16),
          ],

          // ── Action button ───────────────────────────────────────────────
          if (registered && _allReady)
            FilledButton.icon(
              onPressed: processing ? null : onRunNow,
              icon: processing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.play_arrow_rounded),
              label: Text(processing ? 'Processing...' : 'Run Queue Check'),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
              ),
            ),
          if (registered && _allReady) const SizedBox(height: 16),

          // ── Log panel ───────────────────────────────────────────────────
          _LogCard(logs: logs),
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
  });

  final String status;
  final String? currentJobId;
  final String? lastError;
  final bool processing;
  final bool registered;
  final bool allReady;

  Color _statusColor(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (lastError != null) return cs.error;
    if (processing) return cs.primary;
    if (!registered || !allReady) return cs.outline;
    return const Color(0xFF1B6B4D);
  }

  IconData _statusIcon() {
    if (lastError != null) return Icons.error_outline_rounded;
    if (processing) return Icons.sync_rounded;
    if (!registered) return Icons.link_off_rounded;
    if (!allReady) return Icons.warning_amber_rounded;
    return Icons.check_circle_outline_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final color = _statusColor(context);
    return Card(
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
            Row(
              children: [
                Icon(_statusIcon(), color: color, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Status',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(color: cs.outline),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              status,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
            ),
            if (currentJobId != null) ...[
              const SizedBox(height: 4),
              Text(
                'Job: $currentJobId',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: cs.onSurfaceVariant,
                      fontFamily: 'monospace',
                    ),
              ),
            ],
            if (lastError != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: cs.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  lastError!,
                  style: TextStyle(color: cs.onErrorContainer, fontSize: 12),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DeviceInfoCard extends StatelessWidget {
  const _DeviceInfoCard({required this.config});
  final AgentConfig config;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
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
            Text('Device', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: cs.outline)),
            const SizedBox(height: 12),
            _InfoRow(icon: Icons.phone_android, label: 'Name', value: config.name),
            const SizedBox(height: 8),
            _InfoRow(icon: Icons.sim_card, label: 'SIM', value: config.simProvider),
            const SizedBox(height: 8),
            _InfoRow(
              icon: Icons.fingerprint,
              label: 'Device ID',
              value: config.deviceId.length > 16
                  ? '${config.deviceId.substring(0, 16)}…'
                  : config.deviceId,
              mono: true,
            ),
          ],
        ),
      ),
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
        Text('$label  ', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.outline)),
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

class _WarningBanner extends StatelessWidget {
  const _WarningBanner({required this.message, required this.onTap});
  final String message;
  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: cs.errorContainer,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: cs.onErrorContainer, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: TextStyle(color: cs.onErrorContainer, fontSize: 13),
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, color: cs.onErrorContainer, size: 14),
          ],
        ),
      ),
    );
  }
}

class _LogCard extends StatelessWidget {
  const _LogCard({required this.logs});
  final List<String> logs;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
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
            Text('Activity Log',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(color: cs.outline)),
            const SizedBox(height: 12),
            if (logs.isEmpty)
              Text('No events yet.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: cs.outline))
            else
              ...logs.take(20).map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        entry,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(fontFamily: 'monospace', fontSize: 11),
                      ),
                    ),
                  ),
          ],
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
    required this.nameController,
    required this.simProviderController,
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
  final TextEditingController nameController;
  final TextEditingController simProviderController;
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
      appBar: AppBar(
        title: const Text('Settings'),
        elevation: 0,
      ),
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
                          minimumSize: const Size(double.infinity, 48)),
                    ),
                  if (!accessibilityEnabled) ...[
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: onOpenAccessibility,
                      icon: const Icon(Icons.accessibility_new),
                      label: const Text('Open Accessibility Settings'),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 48)),
                    ),
                  ],
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
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
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
                          Icon(Icons.info_outline, color: cs.onTertiaryContainer, size: 14),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Changing the backend will unlink this device.',
                              style: TextStyle(color: cs.onTertiaryContainer, fontSize: 12),
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
                        minimumSize: const Size(double.infinity, 48)),
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
                    Text(lastError!,
                        style: TextStyle(color: cs.error, fontSize: 12)),
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
                              : Text(backendConfigured ? 'Update URL' : 'Verify & Save'),
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
                    _InfoRow(icon: Icons.phone_android, label: 'Name', value: config!.name),
                    const SizedBox(height: 8),
                    _InfoRow(icon: Icons.sim_card, label: 'SIM', value: config!.simProvider),
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
                    TextField(
                      controller: nameController,
                      decoration: const InputDecoration(
                        labelText: 'Device Name',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.phone_android),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: simProviderController,
                      decoration: const InputDecoration(
                        labelText: 'SIM Label',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.sim_card),
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
                      Text(lastError!,
                          style: TextStyle(color: cs.error, fontSize: 12)),
                    ],
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: registering ? null : onRegister,
                      style: FilledButton.styleFrom(
                          minimumSize: const Size(double.infinity, 48)),
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
          child: Icon(icon,
              size: 20, color: granted ? cs.primary : cs.onErrorContainer),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600)),
              Text(subtitle,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: cs.onSurfaceVariant)),
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
              style: TextStyle(color: Colors.white, fontSize: 14, shadows: [
                Shadow(color: Colors.black54, blurRadius: 4),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}
