import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import 'backend_service.dart';
import 'models.dart';
import 'native_bridge.dart';

class AgentApp extends StatefulWidget {
  const AgentApp({super.key});

  @override
  State<AgentApp> createState() => _AgentAppState();
}

class _AgentAppState extends State<AgentApp> {
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
        // JWT token missing or cleared — need to re-register
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
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshCapabilities() async {
    final phoneStatus = await Permission.phone.status;
    final smsStatus = await Permission.sms.status;
    final accessibilityEnabled = await _nativeBridge.isAccessibilityEnabled();
    if (!mounted) {
      return;
    }
    setState(() {
      _phonePermissionGranted = phoneStatus.isGranted;
      _smsPermissionGranted = smsStatus.isGranted;
      _accessibilityEnabled = accessibilityEnabled;
    });
  }

  Future<void> _requestPermissions() async {
    await <Permission>[Permission.phone, Permission.sms].request();
    await _refreshCapabilities();
  }

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
      // Not JSON — treat as plain URL
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

    // Auto-verify the URL if we got one from the QR code
    if (resolvedUrl != null && resolvedUrl.isNotEmpty) {
      await _saveBackendUrl();
    }
  }

  Future<void> _saveBackendUrl() async {
    final rawUrl = _backendUrlController.text.trim();
    final parsed = Uri.tryParse(rawUrl);
    final isValid = parsed != null &&
        parsed.hasScheme &&
        (parsed.scheme == 'http' || parsed.scheme == 'https') &&
        parsed.host.isNotEmpty;

    if (!isValid) {
      setState(() {
        _lastError = 'Backend URL must be a valid http(s) URL.';
      });
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
      }

      if (!mounted) {
        return;
      }

      _nameController.text = preservedName;
      _simProviderController.text = preservedSimProvider;
      _tokenController.clear();

      setState(() {
        _backendConfigured = true;
        _config = null;
        _currentJobId = null;
        _status = wasRegistered
            ? 'Backend updated — register again'
            : 'Endpoint verified';
        if (wasRegistered) {
          _lastError = 'Backend changed. Re-register this device on the new server.';
        }
      });
      _appendLog('Backend URL set to ${BackendService.currentBaseUrl}.');
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _lastError = 'Failed to save backend URL: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _savingBackendUrl = false;
        });
      }
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

      if (!mounted) {
        return;
      }

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
            ? 'Backend reset. Enter and save the correct admin server endpoint before re-registering.'
            : null;
      });
      _appendLog('Backend URL reset to ${BackendService.currentBaseUrl}.');
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _lastError = 'Failed to reset backend URL: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _savingBackendUrl = false;
        });
      }
    }
  }

  Future<void> _registerDevice() async {
    if (_registering) return;
    if (_tokenController.text.trim().isEmpty ||
        _nameController.text.trim().isEmpty ||
        _simProviderController.text.trim().isEmpty) {
      setState(() {
        _lastError = 'Token, device name, and SIM label are required.';
      });
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
      if (mounted) {
        setState(() => _registering = false);
      }
    }
  }

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
    if (config == null || _processing) {
      return;
    }
    if (!_phonePermissionGranted ||
        !_smsPermissionGranted ||
        !_accessibilityEnabled) {
      if (mounted) {
        setState(() {
          _status = 'Waiting for permissions/accessibility';
        });
      }
      return;
    }

    _processing = true;
    try {
      if (mounted) {
        setState(() {
          _status = 'Checking queue';
        });
      }
      final job = await BackendService.fetchNextQueuedJob();
      if (job == null) {
        if (mounted) {
          setState(() {
            _status = 'Idle';
          });
        }
        return;
      }

      final acquired = await BackendService.acquireJobLock(job.jobId);
      if (!acquired) return;

      final liveJob = await BackendService.fetchJob(job.jobId) ?? job;
      if (!mounted) {
        return;
      }
      setState(() {
        _currentJobId = liveJob.jobId;
        _status = 'Processing ${liveJob.jobId}';
        _lastError = null;
      });
      _appendLog(
        'Acquired job ${liveJob.jobId} for ${liveJob.recipientNumber}.',
      );
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

      final flowSegments = BackendService.resolveUssdFlow(
        job: liveJob,
        service: service,
      );
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
              'reason':
                  'No confirmation SMS received within ${service.smsTimeout}s',
            }
          : <String, dynamic>{
              'success': false,
              'reason':
                  'SMS captured, awaiting server-side template validation',
            };

      await BackendService.reportJobResult(
        jobId: liveJob.jobId,
        txId: liveJob.txId,
        rawSms: rawSms,
        isSuccess: false, // server will re-validate from rawSms
        parsedResult: parsedResult,
        ussdStepsExecuted: stepsExecuted,
      );
      _appendLog(
        matchedSms == null
            ? 'Job ${liveJob.jobId} reported without SMS.'
            : 'Job ${liveJob.jobId} reported with SMS from ${matchedSms.address}.',
      );
      if (mounted) {
        setState(() {
          _status = 'Last job reported';
        });
      }
    } catch (error) {
      _appendLog('Queue tick failed: $error');
      final errorStr = error.toString().toLowerCase();

      // JWT revoked or device revoked — reset
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
        setState(() {
          _status = 'Idle';
        });
      }
    }
  }

  Future<SmsEntry?> _waitForConfirmationSms({
    required int sinceMs,
    required ExecutionJob job,
    required ServiceConfig service,
  }) async {
    final deadline = DateTime.now().add(Duration(seconds: service.smsTimeout));
    while (DateTime.now().isBefore(deadline)) {
      final messages = await _nativeBridge.readRecentSms(
        sinceMs: sinceMs,
        maxMessages: 12,
      );
      final picked = BackendService.pickConfirmationSms(
        messages: messages,
        job: job,
        service: service,
      );
      if (picked != null) {
        return picked;
      }
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
    if (!mounted) {
      return;
    }
    setState(() {
      _logs.insert(0, '[$timestamp] $message');
      if (_logs.length > 60) {
        _logs.removeRange(60, _logs.length);
      }
    });
  }

  Future<void> _resetDevice() async {
    await BackendService.clearConfig();
    if (!mounted) {
      return;
    }
    setState(() {
      _config = null;
      _currentJobId = null;
      _status = 'Idle';
      _lastError = null;
      _logs.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final registered = _config != null;
    return Scaffold(
      appBar: AppBar(
        title: const Text('dRecharge Agent'),
        actions: [
          IconButton(
            onPressed: _refreshCapabilities,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _StatusPanel(
              status: _status,
              currentJobId: _currentJobId,
              lastError: _lastError,
            ),
            const SizedBox(height: 16),
            _BackendPanel(
              backendUrlController: _backendUrlController,
              currentBaseUrl: BackendService.currentBaseUrl,
              configured: _backendConfigured,
              saving: _savingBackendUrl,
              registered: registered,
              onSave: _saveBackendUrl,
              onReset: _resetBackendUrl,
              onScanQr: _scanQrCode,
            ),
            const SizedBox(height: 16),
            _CapabilityPanel(
              phoneGranted: _phonePermissionGranted,
              smsGranted: _smsPermissionGranted,
              accessibilityEnabled: _accessibilityEnabled,
              onRequestPermissions: _requestPermissions,
              onOpenAccessibility: _nativeBridge.openAccessibilitySettings,
            ),
            const SizedBox(height: 16),
            if (registered)
              _RegisteredPanel(
                config: _config!,
                processing: _processing,
                onRunNow: _runQueueTick,
                onReset: _resetDevice,
              )
            else if (_backendConfigured)
              _RegistrationPanel(
                tokenController: _tokenController,
                nameController: _nameController,
                simProviderController: _simProviderController,
                registering: _registering,
                onRegister: _registerDevice,
              )
            else
              const _SetupHintPanel(),
            const SizedBox(height: 16),
            _LogPanel(logs: _logs),
          ],
        ),
      ),
    );
  }
}

class _SetupHintPanel extends StatelessWidget {
  const _SetupHintPanel();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Device Setup',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            const Text(
              'Enter and verify the admin server endpoint above to continue with device registration.',
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({
    required this.status,
    required this.currentJobId,
    required this.lastError,
  });

  final String status;
  final String? currentJobId;
  final String? lastError;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Execution State',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Text(status, style: Theme.of(context).textTheme.headlineSmall),
            if (currentJobId != null) ...[
              const SizedBox(height: 8),
              Text('Current job: $currentJobId'),
            ],
            if (lastError != null) ...[
              const SizedBox(height: 12),
              Text(lastError!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}

class _CapabilityPanel extends StatelessWidget {
  const _CapabilityPanel({
    required this.phoneGranted,
    required this.smsGranted,
    required this.accessibilityEnabled,
    required this.onRequestPermissions,
    required this.onOpenAccessibility,
  });

  final bool phoneGranted;
  final bool smsGranted;
  final bool accessibilityEnabled;
  final Future<void> Function() onRequestPermissions;
  final Future<void> Function() onOpenAccessibility;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Device Requirements',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _pill('Phone permission', phoneGranted),
                _pill('SMS permission', smsGranted),
                _pill('Accessibility service', accessibilityEnabled),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: onRequestPermissions,
                    child: const Text('Grant Permissions'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: onOpenAccessibility,
                    child: const Text('Open Accessibility'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _pill(String label, bool ok) {
    return Chip(
      label: Text(label),
      avatar: Icon(
        ok ? Icons.check_circle : Icons.error_outline,
        color: ok ? Colors.green : Colors.orange,
        size: 18,
      ),
    );
  }
}

class _BackendPanel extends StatelessWidget {
  const _BackendPanel({
    required this.backendUrlController,
    required this.currentBaseUrl,
    required this.configured,
    required this.saving,
    required this.registered,
    required this.onSave,
    required this.onReset,
    required this.onScanQr,
  });

  final TextEditingController backendUrlController;
  final String currentBaseUrl;
  final bool configured;
  final bool saving;
  final bool registered;
  final Future<void> Function() onSave;
  final Future<void> Function() onReset;
  final Future<void> Function() onScanQr;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Backend Connection',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              configured
                  ? 'Connected: $currentBaseUrl'
                  : 'Scan the QR code from the admin panel, or enter the server URL manually.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (registered) ...[
              const SizedBox(height: 8),
              const Text(
                'Changing the backend clears the current device registration.',
                style: TextStyle(color: Colors.orange),
              ),
            ] else if (!configured) ...[
              const SizedBox(height: 8),
              const Text(
                'Example: https://admin.example.com or http://10.0.2.2:3000 for emulator.',
                style: TextStyle(color: Colors.orange),
              ),
            ],
            const SizedBox(height: 12),
            // QR scan shortcut
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: saving ? null : onScanQr,
                icon: const Icon(Icons.qr_code_scanner),
                label: const Text('Scan QR from Admin Panel'),
              ),
            ),
            const SizedBox(height: 8),
            const Row(
              children: [
                Expanded(child: Divider()),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('or enter manually', style: TextStyle(fontSize: 12, color: Colors.grey)),
                ),
                Expanded(child: Divider()),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: backendUrlController,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: 'Backend URL',
                hintText: 'https://your-admin.example.com',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: saving ? null : onSave,
                    child: Text(
                      saving
                          ? 'Verifying...'
                          : configured
                              ? 'Save Endpoint'
                              : 'Verify & Continue',
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: saving ? null : onReset,
                    child: const Text('Reset'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RegistrationPanel extends StatelessWidget {
  const _RegistrationPanel({
    required this.tokenController,
    required this.nameController,
    required this.simProviderController,
    required this.registering,
    required this.onRegister,
  });

  final TextEditingController tokenController;
  final TextEditingController nameController;
  final TextEditingController simProviderController;
  final bool registering;
  final Future<void> Function() onRegister;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Register Device',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameController,
              decoration: const InputDecoration(
                labelText: 'Device name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: simProviderController,
              decoration: const InputDecoration(
                labelText: 'SIM label',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: tokenController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Registration token',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: registering ? null : onRegister,
                child: Text(registering ? 'Registering...' : 'Register Device'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RegisteredPanel extends StatelessWidget {
  const _RegisteredPanel({
    required this.config,
    required this.processing,
    required this.onRunNow,
    required this.onReset,
  });

  final AgentConfig config;
  final bool processing;
  final Future<void> Function() onRunNow;
  final Future<void> Function() onReset;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Registered Device',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Text('Device ID: ${config.deviceId}'),
            Text('Name: ${config.name}'),
            Text('SIM: ${config.simProvider}'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: processing ? null : onRunNow,
                    child: const Text('Run Queue Check'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: onReset,
                    child: const Text('Reset Device'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LogPanel extends StatelessWidget {
  const _LogPanel({required this.logs});

  final List<String> logs;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Runtime Log', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (logs.isEmpty)
              const Text('No events yet.')
            else
              ...logs.map(
                (entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(entry),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── QR Scanner ────────────────────────────────────────────────────────────────

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
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // Overlay with scan region guide
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
