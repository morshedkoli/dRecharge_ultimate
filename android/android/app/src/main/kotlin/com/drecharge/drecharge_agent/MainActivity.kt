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
                    "executeUssdSteps" -> handleExecuteUssdSteps(call, result)
                    "executeUssdFlow"  -> handleExecuteUssdFlow(call, result)
                    "readRecentSms"    -> handleReadRecentSms(call, result)
                    else -> result.notImplemented()
                }
            }
    }

    @Suppress("UNCHECKED_CAST")
    private fun handleExecuteUssdSteps(call: MethodCall, result: MethodChannel.Result) {
        val rawSteps = call.argument<List<*>>("steps")
        val simSlot       = call.argument<Int>("simSlot")       ?: 1
        val perStepDelayMs = call.argument<Int>("perStepDelayMs") ?: 1200
        val stepTimeoutMs  = call.argument<Int>("stepTimeoutMs")  ?: 15000

        if (rawSteps.isNullOrEmpty()) {
            result.error("invalid_args", "steps is required and must not be empty", null)
            return
        }

        val steps = try {
            rawSteps.filterIsInstance<Map<*, *>>().map { m ->
                UssdStep(
                    order  = (m["order"]  as? Int)   ?: 0,
                    type   = (m["type"]   as? String) ?: "input",
                    label  = (m["label"]  as? String) ?: "",
                    value  = (m["value"]  as? String) ?: "",
                    waitMs = (m["waitMs"] as? Int),
                )
            }
        } catch (e: Exception) {
            result.error("invalid_args", "Failed to parse steps: ${e.message}", null)
            return
        }

        UssdAutomationManager.executeSteps(
            activity       = this,
            steps          = steps,
            simSlot        = simSlot,
            perStepDelayMs = perStepDelayMs,
            stepTimeoutMs  = stepTimeoutMs,
            result         = result,
        )
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
