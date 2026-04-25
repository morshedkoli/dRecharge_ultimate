package com.drecharge.drecharge_agent

import android.app.KeyguardManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.StatFs
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelName = "drecharge_agent/native"
    private var screenWakeLock: PowerManager.WakeLock? = null

    override fun onResume() {
        super.onResume()
        startAgentService()
    }

    private fun startAgentService() {
        val serviceIntent = Intent(this, AgentForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }

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
                    "executeUssdSteps"  -> handleExecuteUssdSteps(call, result)
                    "executeUssdFlow"   -> handleExecuteUssdFlow(call, result)
                    "readRecentSms"     -> handleReadRecentSms(call, result)
                    "getStorageInfo"    -> handleGetStorageInfo(result)
                    "wakeScreen"        -> handleWakeScreen(result)
                    "releaseWakeLock"   -> handleReleaseWakeLock(result)
                    "openUrl"           -> handleOpenUrl(call, result)
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
            context        = this,
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
            context        = this,
            flowSegments   = flowSegments,
            simSlot        = simSlot,
            perStepDelayMs = perStepDelayMs,
            stepTimeoutMs  = stepTimeoutMs,
            result         = result,
        )
    }

    private fun handleReadRecentSms(call: MethodCall, result: MethodChannel.Result) {
        val sinceMs = call.argument<Number>("sinceMs")?.toLong() ?: 0L
        val maxMessages = call.argument<Int>("maxMessages") ?: 12
        result.success(SmsReader.readRecentSms(this, sinceMs, maxMessages))
    }

    private fun handleGetStorageInfo(result: MethodChannel.Result) {
        try {
            val path = Environment.getDataDirectory()
            val stat = StatFs(path.path)
            val blockSize = stat.blockSizeLong
            val totalMb = (stat.blockCountLong * blockSize) / (1024L * 1024L)
            val freeMb  = (stat.availableBlocksLong * blockSize) / (1024L * 1024L)
            result.success(mapOf("totalMb" to totalMb, "freeMb" to freeMb))
        } catch (e: Exception) {
            result.success(mapOf("totalMb" to 0L, "freeMb" to 0L))
        }
    }

    @Suppress("DEPRECATION")
    private fun handleWakeScreen(result: MethodChannel.Result) {
        try {
            // Acquire wake lock — turns screen on
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            screenWakeLock?.let { if (it.isHeld) it.release() }
            val wl = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP or
                PowerManager.ON_AFTER_RELEASE,
                "drecharge:job_exec"
            )
            wl.acquire(60_000L) // 60s max — released early by releaseWakeLock
            screenWakeLock = wl

            // Dismiss keyguard so USSD dialog is visible
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
                val km = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
                km.requestDismissKeyguard(this, null)
            } else {
                window.addFlags(
                    android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                )
            }

            result.success(true)
        } catch (e: Exception) {
            result.error("wake_error", e.message, null)
        }
    }

    private fun handleReleaseWakeLock(result: MethodChannel.Result) {
        try {
            screenWakeLock?.let { if (it.isHeld) it.release() }
            screenWakeLock = null
            result.success(true)
        } catch (e: Exception) {
            result.error("wake_release_error", e.message, null)
        }
    }

    private fun handleOpenUrl(call: MethodCall, result: MethodChannel.Result) {
        try {
            val url = call.argument<String>("url") ?: return result.error("missing_arg", "url required", null)
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            result.success(true)
        } catch (e: Exception) {
            result.error("open_url_error", e.message, null)
        }
    }

    override fun onDestroy() {
        screenWakeLock?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }
}
