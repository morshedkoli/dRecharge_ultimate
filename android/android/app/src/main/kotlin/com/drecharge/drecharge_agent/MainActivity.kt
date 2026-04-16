package com.drecharge.drecharge_agent

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelName = "drecharge_agent/native"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "isAccessibilityEnabled" -> {
                        result.success(UssdAutomationManager.isAccessibilityEnabled())
                    }
                    "openAccessibilitySettings" -> {
                        UssdAutomationManager.openAccessibilitySettings(this)
                        result.success(null)
                    }
                    "executeUssdFlow" -> handleExecuteUssdFlow(call, result)
                    "readRecentSms" -> handleReadRecentSms(call, result)
                    else -> result.notImplemented()
                }
            }
    }

    private fun handleExecuteUssdFlow(call: MethodCall, result: MethodChannel.Result) {
        val flowSegments = call.argument<List<String>>("flowSegments")
        val simSlot = call.argument<Int>("simSlot") ?: 1
        val perStepDelayMs = call.argument<Int>("perStepDelayMs") ?: 1200
        val stepTimeoutMs = call.argument<Int>("stepTimeoutMs") ?: 15000

        if (flowSegments.isNullOrEmpty()) {
            result.error("invalid_args", "flowSegments is required", null)
            return
        }

        UssdAutomationManager.executeFlow(
            activity = this,
            flowSegments = flowSegments,
            simSlot = simSlot,
            perStepDelayMs = perStepDelayMs,
            stepTimeoutMs = stepTimeoutMs,
            result = result,
        )
    }

    private fun handleReadRecentSms(call: MethodCall, result: MethodChannel.Result) {
        val sinceMs = call.argument<Number>("sinceMs")?.toLong() ?: 0L
        val maxMessages = call.argument<Int>("maxMessages") ?: 12
        result.success(SmsReader.readRecentSms(this, sinceMs, maxMessages))
    }
}
