import 'package:flutter/services.dart';

import 'models.dart';

class NativeBridge {
  static const MethodChannel _channel = MethodChannel('drecharge_agent/native');

  Future<bool> isAccessibilityEnabled() async {
    final enabled = await _channel.invokeMethod<bool>('isAccessibilityEnabled');
    return enabled ?? false;
  }

  Future<void> openAccessibilitySettings() {
    return _channel.invokeMethod<void>('openAccessibilitySettings');
  }

  Future<void> syncBackgroundConfig({
    required String baseUrl,
    required bool isPoweredOn,
    String? jwtToken,
    String? deviceName,
    String? simProvider,
  }) async {
    final payload = <String, dynamic>{
      'baseUrl': baseUrl,
      'isPoweredOn': isPoweredOn,
    };
    if (jwtToken != null) payload['jwtToken'] = jwtToken;
    if (deviceName != null) payload['deviceName'] = deviceName;
    if (simProvider != null) payload['simProvider'] = simProvider;
    await _channel.invokeMethod<void>('syncBackgroundConfig', payload);
  }

  Future<void> clearBackgroundConfig() async {
    await _channel.invokeMethod<void>('clearBackgroundConfig');
  }

  Future<void> startBackgroundService() async {
    await _channel.invokeMethod<void>('startBackgroundService');
  }

  // ── Structured step executor ─────────────────────────────────────────────

  /// Execute a list of structured [UssdStep]s.
  ///
  /// The native side receives a typed list so it knows exactly what each step
  /// means — dial, select, input, or wait — with no guessing from string values.
  ///
  /// Returns a list of step-result maps to report back to the server.
  Future<List<Map<String, dynamic>>> executeUssdSteps({
    required List<UssdStep> steps,
    required int simSlot,
    int perStepDelayMs = 1200,
    int stepTimeoutMs = 15000,
  }) async {
    final stepsPayload = steps.map((s) => s.toMap()).toList();
    final result = await _channel
        .invokeListMethod<dynamic>('executeUssdSteps', <String, dynamic>{
      'steps': stepsPayload,
      'simSlot': simSlot,
      'perStepDelayMs': perStepDelayMs,
      'stepTimeoutMs': stepTimeoutMs,
    });
    return (result ?? <dynamic>[])
        .whereType<Map<Object?, Object?>>()
        .map((entry) => entry.map((key, value) => MapEntry(key.toString(), value)))
        .toList();
  }

  Future<List<SmsEntry>> readRecentSms({
    required int sinceMs,
    int maxMessages = 12,
  }) async {
    final result = await _channel.invokeListMethod<dynamic>(
      'readRecentSms',
      <String, dynamic>{'sinceMs': sinceMs, 'maxMessages': maxMessages},
    );
    return (result ?? <dynamic>[])
        .whereType<Map<Object?, Object?>>()
        .map(SmsEntry.fromMap)
        .toList();
  }

  Future<void> wakeScreen() async {
    await _channel.invokeMethod<void>('wakeScreen');
  }

  Future<void> releaseWakeLock() async {
    await _channel.invokeMethod<void>('releaseWakeLock');
  }

  /// Opens the Android App Info page where the user can tap
  /// "Allow restricted settings" (Android 13+).
  Future<void> openAppInfo() async {
    await _channel.invokeMethod<void>('openAppInfo');
  }

  /// Opens the Battery Optimization exemption screen for this app.
  Future<void> openBatterySettings() async {
    await _channel.invokeMethod<void>('openBatterySettings');
  }

  /// Returns true if app can schedule exact alarms (Android 12+ only).
  /// Always returns true on Android < 12.
  Future<bool> isExactAlarmGranted() async {
    final granted = await _channel.invokeMethod<bool>('isExactAlarmGranted');
    return granted ?? true;
  }

  /// Opens the system screen to grant SCHEDULE_EXACT_ALARM (Android 12+).
  Future<void> openExactAlarmSettings() async {
    await _channel.invokeMethod<void>('openExactAlarmSettings');
  }
}
