// ─── SubscriptionInfo ────────────────────────────────────────────────────────

class SubscriptionInfo {
  const SubscriptionInfo({
    required this.state,
    required this.subscribed,
    required this.tracked,
    required this.expired,
    required this.expiresAt,
    required this.daysUntilExpiry,
    required this.domain,
    required this.checkedAt,
    this.appName,
    this.logoUrl,
  });

  final String state; // "active" | "expired" | "inactive" | "untracked" | "unknown"
  final bool subscribed;
  final bool tracked;
  final bool expired;
  final DateTime? expiresAt;
  final int? daysUntilExpiry;
  final String domain;
  final DateTime checkedAt;
  final String? appName;
  /// Relative path from API — prepend "https://drecharge.com" before using.
  final String? logoUrl;

  bool get isActive   => state == 'active';
  bool get isExpiring => state == 'active' && daysUntilExpiry != null && daysUntilExpiry! <= 14;

  /// Full absolute URL for the logo, or null if unavailable.
  String? get logoFullUrl {
    if (logoUrl == null || logoUrl!.isEmpty) return null;
    // Already an absolute URL — use as-is
    if (logoUrl!.startsWith('http://') || logoUrl!.startsWith('https://')) {
      return logoUrl;
    }
    // Relative path — prepend base, ensuring exactly one slash separator
    final path = logoUrl!.startsWith('/') ? logoUrl! : '/$logoUrl';
    return 'https://drecharge.com$path';
  }

  factory SubscriptionInfo.fromMap(Map<String, dynamic> data) {
    return SubscriptionInfo(
      state: (data['state'] ?? 'unknown').toString(),
      subscribed: data['subscribed'] == true,
      tracked: data['tracked'] == true,
      expired: data['expired'] == true,
      expiresAt: data['expiresAt'] != null
          ? DateTime.tryParse(data['expiresAt'].toString())
          : null,
      daysUntilExpiry: data['daysUntilExpiry'] is int
          ? data['daysUntilExpiry'] as int
          : int.tryParse('${data['daysUntilExpiry'] ?? ''}'),
      domain: (data['domain'] ?? '').toString(),
      checkedAt: data['checkedAt'] != null
          ? DateTime.tryParse(data['checkedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      appName: data['appName']?.toString(),
      logoUrl: data['logoUrl']?.toString(),
    );
  }
}

// ─── AgentConfig ────────────────────────────────────────────────────────────

class AgentConfig {
  const AgentConfig({
    required this.deviceId,
    required this.name,
    required this.simProvider,
  });

  final String deviceId;
  final String name;
  final String simProvider;
}

// ─── SmsFailureTemplate ──────────────────────────────────────────────────────

/// A single failure SMS template with an admin-configured user-facing message.
class SmsFailureTemplate {
  const SmsFailureTemplate({required this.template, required this.message});

  /// SMS pattern (may contain placeholder tokens like {recipientNumber}, {amount})
  final String template;

  /// User-facing reason shown in notifications and transaction history
  final String message;

  factory SmsFailureTemplate.fromMap(Map<String, dynamic> data) {
    return SmsFailureTemplate(
      template: (data['template'] ?? '').toString(),
      message: (data['message'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toMap() => {'template': template, 'message': message};
}

// ─── UssdStep ────────────────────────────────────────────────────────────────

/// A single step in a structured USSD flow.
///
/// Types:
///   dial   – open the USSD session by dialling the code (e.g. *247#)
///   select – press a numeric menu option
///   input  – type freeform text (recipient, amount, pin, …)
///   wait   – pause [waitMs] milliseconds before the next step
class UssdStep {
  const UssdStep({
    required this.order,
    required this.type,
    required this.label,
    required this.value,
    this.waitMs,
  });

  final int order;
  final String type; // "dial" | "select" | "input" | "wait"
  final String label;
  final String value; // for "wait" steps this is the ms as a string
  final int? waitMs;

  factory UssdStep.fromMap(Map<String, dynamic> data) {
    return UssdStep(
      order: data['order'] is int
          ? data['order'] as int
          : int.tryParse('${data['order']}') ?? 0,
      type: (data['type'] ?? 'input').toString(),
      label: (data['label'] ?? '').toString(),
      value: (data['value'] ?? '').toString(),
      waitMs: data['waitMs'] is int
          ? data['waitMs'] as int
          : int.tryParse('${data['waitMs']}'),
    );
  }

  Map<String, dynamic> toMap() => {
    'order': order,
    'type': type,
    'label': label,
    'value': value,
    if (waitMs != null) 'waitMs': waitMs,
  };

  bool get isDial => type == 'dial';
  bool get isSelect => type == 'select';
  bool get isInput => type == 'input';
  bool get isWait => type == 'wait';

  int get effectiveWaitMs =>
      isWait ? (waitMs ?? int.tryParse(value) ?? 1000) : 0;
}

Map<String, dynamic>? _asStringKeyedMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, entry) => MapEntry(key.toString(), entry));
  }
  return null;
}

List<UssdStep> _parseStructuredSteps(Object? rawSteps) {
  if (rawSteps is! List || rawSteps.isEmpty) return <UssdStep>[];

  final steps =
      rawSteps
          .map(_asStringKeyedMap)
          .whereType<Map<String, dynamic>>()
          .map(UssdStep.fromMap)
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));

  return steps;
}

List<UssdStep> _parseLegacyFlow(Object? rawFlow) {
  if (rawFlow is! String || rawFlow.trim().isEmpty) return <UssdStep>[];

  final segments = rawFlow
      .split('-')
      .map((segment) => segment.trim())
      .where((segment) => segment.isNotEmpty)
      .toList();

  if (segments.isEmpty) return <UssdStep>[];

  return List<UssdStep>.generate(segments.length, (index) {
    final value = segments[index];
    final isWait =
        index > 0 &&
        RegExp(r'^wait[:=]\d+$', caseSensitive: false).hasMatch(value);
    final type = index == 0
        ? 'dial'
        : isWait
        ? 'wait'
        : RegExp(r'^\d+$').hasMatch(value)
        ? 'select'
        : 'input';

    return UssdStep(
      order: index + 1,
      type: type,
      label: switch (type) {
        'dial' => 'Dial',
        'select' => 'Select $index',
        'wait' => 'Wait $index',
        _ => 'Input $index',
      },
      value: isWait
          ? value.replaceFirst(RegExp(r'^wait[:=]', caseSensitive: false), '')
          : value,
      waitMs: isWait
          ? int.tryParse(
              value.replaceFirst(
                RegExp(r'^wait[:=]', caseSensitive: false),
                '',
              ),
            )
          : null,
    );
  });
}

// ─── ExecutionJob ─────────────────────────────────────────────────────────────

class ExecutionJob {
  ExecutionJob({
    required this.jobId,
    required this.txId,
    required this.serviceId,
    required this.recipientNumber,
    required this.amount,
    required this.status,
    required this.locked,
    required this.attempt,
    this.ussdSteps,
    this.simSlot = 1,
    this.smsTimeout = 30,
    this.successSmsFormat,
    this.failureSmsTemplates = const [],
    this.createdAt,
  });

  final String jobId;
  final String txId;
  final String serviceId;
  final String recipientNumber;
  final num amount;
  final String status;
  final bool locked;
  final int attempt;

  /// Structured steps with placeholders already resolved by the server.
  final List<UssdStep>? ussdSteps;

  final int simSlot;
  final int smsTimeout;
  final String? successSmsFormat;

  /// Multi-failure templates: each has a pattern and a user-facing reason.
  final List<SmsFailureTemplate> failureSmsTemplates;

  final DateTime? createdAt;

  /// Returns true when this job carries structured step data.
  bool get hasStructuredSteps => ussdSteps != null && ussdSteps!.isNotEmpty;

  factory ExecutionJob.fromMap(Map<String, dynamic> data) {
    final structuredSteps = _parseStructuredSteps(data['ussdSteps']);
    final legacySteps = structuredSteps.isEmpty
        ? _parseLegacyFlow(data['ussdFlow'])
        : <UssdStep>[];
    final steps = structuredSteps.isNotEmpty
        ? structuredSteps
        : legacySteps.isNotEmpty
        ? legacySteps
        : null;

    // Parse failureSmsTemplates array
    List<SmsFailureTemplate> failureTemplates = [];
    final rawFailure = data['failureSmsTemplates'];
    if (rawFailure is List && rawFailure.isNotEmpty) {
      failureTemplates = rawFailure
          .map(_asStringKeyedMap)
          .whereType<Map<String, dynamic>>()
          .map(SmsFailureTemplate.fromMap)
          .toList();
    }

    return ExecutionJob(
      jobId: (data['jobId'] ?? data['_id'] ?? '').toString(),
      txId: (data['txId'] ?? '').toString(),
      serviceId: (data['serviceId'] ?? '').toString(),
      recipientNumber: (data['recipientNumber'] ?? '').toString(),
      amount: data['amount'] is num
          ? data['amount'] as num
          : num.tryParse('${data['amount']}') ?? 0,
      status: (data['status'] ?? 'queued').toString(),
      locked: data['locked'] == true,
      attempt: data['attempt'] is int
          ? data['attempt'] as int
          : int.tryParse('${data['attempt']}') ?? 0,
      ussdSteps: steps,
      simSlot: data['simSlot'] is int
          ? data['simSlot'] as int
          : int.tryParse('${data['simSlot']}') ?? 1,
      smsTimeout: data['smsTimeout'] is int
          ? data['smsTimeout'] as int
          : int.tryParse('${data['smsTimeout']}') ?? 30,
      successSmsFormat: data['successSmsFormat']?.toString(),
      failureSmsTemplates: failureTemplates,
      createdAt: data['createdAt'] != null
          ? DateTime.tryParse(data['createdAt'].toString())
          : null,
    );
  }
}

// ─── ServiceConfig ───────────────────────────────────────────────────────────

class ServiceConfig {
  ServiceConfig({
    required this.serviceId,
    required this.name,
    required this.ussdSteps,
    required this.pin,
    required this.simSlot,
    required this.smsTimeout,
    required this.successSmsFormat,
    required this.failureSmsTemplates,
    required this.isActive,
  });

  final String serviceId;
  final String name;
  final List<UssdStep> ussdSteps;
  final String pin;
  final int simSlot;
  final int smsTimeout;
  final String successSmsFormat;
  final List<SmsFailureTemplate> failureSmsTemplates;
  final bool isActive;

  factory ServiceConfig.fromMap(Map<String, dynamic> data) {
    final structuredSteps = _parseStructuredSteps(data['ussdSteps']);
    final steps = structuredSteps.isNotEmpty
        ? structuredSteps
        : _parseLegacyFlow(data['ussdFlow']);

    List<SmsFailureTemplate> failureTemplates = [];
    final rawFailure = data['failureSmsTemplates'];
    if (rawFailure is List && rawFailure.isNotEmpty) {
      failureTemplates = rawFailure
          .map(_asStringKeyedMap)
          .whereType<Map<String, dynamic>>()
          .map(SmsFailureTemplate.fromMap)
          .toList();
    }

    return ServiceConfig(
      serviceId: (data['id'] ?? '').toString(),
      name: (data['name'] ?? '').toString(),
      ussdSteps: steps,
      pin: (data['pin'] ?? '').toString(),
      simSlot: data['simSlot'] is int
          ? data['simSlot'] as int
          : int.tryParse('${data['simSlot']}') ?? 1,
      smsTimeout: data['smsTimeout'] is int
          ? data['smsTimeout'] as int
          : int.tryParse('${data['smsTimeout']}') ?? 30,
      successSmsFormat: (data['successSmsFormat'] ?? '').toString(),
      failureSmsTemplates: failureTemplates,
      isActive: data['isActive'] != false,
    );
  }
}

// ─── SmsEntry ────────────────────────────────────────────────────────────────

class SmsEntry {
  const SmsEntry({
    required this.address,
    required this.body,
    required this.dateMs,
  });

  final String address;
  final String body;
  final int dateMs;

  factory SmsEntry.fromMap(Map<Object?, Object?> data) {
    return SmsEntry(
      address: (data['address'] ?? '').toString(),
      body: (data['body'] ?? '').toString(),
      dateMs: data['dateMs'] is int
          ? data['dateMs'] as int
          : int.tryParse('${data['dateMs']}') ?? 0,
    );
  }
}
