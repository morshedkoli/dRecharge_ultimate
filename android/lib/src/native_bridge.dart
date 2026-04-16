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
