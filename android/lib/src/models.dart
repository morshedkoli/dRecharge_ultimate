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
    this.rawUssdFlow,
    this.simSlot = 1,
    this.smsTimeout = 30,
    this.successSmsFormat,
    this.failureSmsFormat,
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
  final String? ussdFlow;
  final String? rawUssdFlow;
  final int simSlot;
  final int smsTimeout;
  final String? successSmsFormat;
  final String? failureSmsFormat;
  final DateTime? createdAt;

  factory ExecutionJob.fromMap(Map<String, dynamic> data) {
    return ExecutionJob(
      jobId: (data['jobId'] ?? '').toString(),
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
      rawUssdFlow: data['rawUssdFlow']?.toString(),
      simSlot: data['simSlot'] is int
          ? data['simSlot'] as int
          : int.tryParse('${data['simSlot']}') ?? 1,
      smsTimeout: data['smsTimeout'] is int
          ? data['smsTimeout'] as int
          : int.tryParse('${data['smsTimeout']}') ?? 30,
      successSmsFormat: data['successSmsFormat']?.toString(),
      failureSmsFormat: data['failureSmsFormat']?.toString(),
      createdAt: data['createdAt'] != null
          ? DateTime.tryParse(data['createdAt'].toString())
          : null,
    );
  }
}

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
  });

  final String serviceId;
  final String name;
  final String ussdFlow;
  final String pin;
  final int simSlot;
  final int smsTimeout;
  final String successSmsFormat;
  final String failureSmsFormat;
  final bool isActive;

  factory ServiceConfig.fromMap(Map<String, dynamic> data) {
    return ServiceConfig(
      serviceId: (data['id'] ?? '').toString(),
      name: (data['name'] ?? '').toString(),
      ussdFlow: (data['ussdFlow'] ?? '').toString(),
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
