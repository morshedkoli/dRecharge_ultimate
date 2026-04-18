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

  // ── New structured step executor ─────────────────────────────────────────

  /// Execute a list of structured [UssdStep]s.
  ///
  /// The native side receives a typed list so it knows exactly what each step
  /// means — no more guessing from string values.
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

  // ── Legacy flow executor (kept for backward compat) ──────────────────────

  /// Execute a pre-parsed list of USSD segments (old hyphen-split format).
  /// Prefer [executeUssdSteps] when structured steps are available.
  Future<List<Map<String, dynamic>>> executeUssdFlow({
    required List<String> flowSegments,
    required int simSlot,
    int perStepDelayMs = 1200,
    int stepTimeoutMs = 15000,
  }) async {
    final result = await _channel
        .invokeListMethod<dynamic>('executeUssdFlow', <String, dynamic>{
          'flowSegments': flowSegments,
          'simSlot': simSlot,
          'perStepDelayMs': perStepDelayMs,
          'stepTimeoutMs': stepTimeoutMs,
        });
    return (result ?? <dynamic>[])
        .whereType<Map<Object?, Object?>>()
        .map(
          (entry) => entry.map((key, value) => MapEntry(key.toString(), value)),
        )
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
}
