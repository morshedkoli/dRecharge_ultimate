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
  final String type;   // "dial" | "select" | "input" | "wait"
  final String label;
  final String value;  // for "wait" steps this is the ms as a string
  final int? waitMs;

  factory UssdStep.fromMap(Map<String, dynamic> data) {
    return UssdStep(
      order: data['order'] is int
          ? data['order'] as int
          : int.tryParse('${data['order']}') ?? 0,
      type:  (data['type']  ?? 'input').toString(),
      label: (data['label'] ?? '').toString(),
      value: (data['value'] ?? '').toString(),
      waitMs: data['waitMs'] is int
          ? data['waitMs'] as int
          : int.tryParse('${data['waitMs']}'),
    );
  }

  Map<String, dynamic> toMap() => {
        'order':  order,
        'type':   type,
        'label':  label,
        'value':  value,
        if (waitMs != null) 'waitMs': waitMs,
      };

  bool get isDial   => type == 'dial';
  bool get isSelect => type == 'select';
  bool get isInput  => type == 'input';
  bool get isWait   => type == 'wait';

  int get effectiveWaitMs => isWait ? (waitMs ?? int.tryParse(value) ?? 1000) : 0;
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
    this.ussdFlow,
    this.ussdSteps,
    this.rawUssdFlow,
    this.simSlot = 1,
    this.smsTimeout = 30,
    this.successSmsFormat,
    this.failureSmsFormat,
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

  /// Legacy resolved USSD string — still populated for backward compat.
  final String? ussdFlow;

  /// Structured steps with placeholders already resolved by the server.
  /// This is the preferred execution path.
  final List<UssdStep>? ussdSteps;

  final String? rawUssdFlow;
  final int simSlot;
  final int smsTimeout;
  final String? successSmsFormat;
  final String? failureSmsFormat;

  /// Multi-failure templates: each has a pattern and a user-facing reason.
  /// Preferred over the single [failureSmsFormat] for failure detection.
  final List<SmsFailureTemplate> failureSmsTemplates;

  final DateTime? createdAt;

  /// Returns true when this job carries structured step data.
  bool get hasStructuredSteps =>
      ussdSteps != null && ussdSteps!.isNotEmpty;

  factory ExecutionJob.fromMap(Map<String, dynamic> data) {
    // Parse ussdSteps array if present
    List<UssdStep>? steps;
    final rawSteps = data['ussdSteps'];
    if (rawSteps is List && rawSteps.isNotEmpty) {
      steps = rawSteps
          .whereType<Map<String, dynamic>>()
          .map(UssdStep.fromMap)
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));
    }

    // Parse failureSmsTemplates array if present
    List<SmsFailureTemplate> failureTemplates = [];
    final rawFailure = data['failureSmsTemplates'];
    if (rawFailure is List && rawFailure.isNotEmpty) {
      failureTemplates = rawFailure
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
      ussdFlow: data['ussdFlow']?.toString(),
      ussdSteps: steps,
      rawUssdFlow: data['rawUssdFlow']?.toString(),
      simSlot: data['simSlot'] is int
          ? data['simSlot'] as int
          : int.tryParse('${data['simSlot']}') ?? 1,
      smsTimeout: data['smsTimeout'] is int
          ? data['smsTimeout'] as int
          : int.tryParse('${data['smsTimeout']}') ?? 30,
      successSmsFormat: data['successSmsFormat']?.toString(),
      failureSmsFormat: data['failureSmsFormat']?.toString(),
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
    required this.ussdFlow,
    required this.pin,
    required this.simSlot,
    required this.smsTimeout,
    required this.successSmsFormat,
    required this.failureSmsFormat,
    required this.isActive,
    this.ussdSteps,
  });

  final String serviceId;
  final String name;
  final String ussdFlow;
  final List<UssdStep>? ussdSteps;
  final String pin;
  final int simSlot;
  final int smsTimeout;
  final String successSmsFormat;
  final String failureSmsFormat;
  final bool isActive;

  factory ServiceConfig.fromMap(Map<String, dynamic> data) {
    List<UssdStep>? steps;
    final rawSteps = data['ussdSteps'];
    if (rawSteps is List && rawSteps.isNotEmpty) {
      steps = rawSteps
          .whereType<Map<String, dynamic>>()
          .map(UssdStep.fromMap)
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));
    }

    return ServiceConfig(
      serviceId: (data['id'] ?? '').toString(),
      name: (data['name'] ?? '').toString(),
      ussdFlow: (data['ussdFlow'] ?? '').toString(),
      ussdSteps: steps,
      pin: (data['pin'] ?? '').toString(),
      simSlot: data['simSlot'] is int
          ? data['simSlot'] as int
          : int.tryParse('${data['simSlot']}') ?? 1,
      smsTimeout: data['smsTimeout'] is int
          ? data['smsTimeout'] as int
          : int.tryParse('${data['smsTimeout']}') ?? 30,
      successSmsFormat: (data['successSmsFormat'] ?? '').toString(),
      failureSmsFormat: (data['failureSmsFormat'] ?? '').toString(),
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
