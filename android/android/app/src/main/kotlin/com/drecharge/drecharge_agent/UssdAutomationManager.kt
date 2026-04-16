package com.drecharge.drecharge_agent

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.net.toUri
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.time.Instant

object UssdAutomationManager {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var session: UssdSession? = null

    fun isAccessibilityEnabled(): Boolean {
        return UssdAccessibilityService.instance != null
    }

    fun openAccessibilitySettings(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
        )
    }

    fun executeFlow(
        activity: FlutterActivity,
        flowSegments: List<String>,
        simSlot: Int,
        perStepDelayMs: Int,
        stepTimeoutMs: Int,
        result: MethodChannel.Result,
    ) {
        if (UssdAccessibilityService.instance == null) {
            result.error(
                "accessibility_required",
                "Enable the dRecharge accessibility service before executing USSD flows.",
                null,
            )
            return
        }
        if (session != null) {
            result.error("busy", "A USSD session is already running.", null)
            return
        }

        val cleanSegments = flowSegments.map { it.trim() }.filter { it.isNotEmpty() }
        if (cleanSegments.isEmpty()) {
            result.error("invalid_args", "USSD flow is empty.", null)
            return
        }

        val newSession = UssdSession(
            activity = activity,
            flowSegments = cleanSegments,
            simSlot = simSlot,
            perStepDelayMs = perStepDelayMs,
            stepTimeoutMs = stepTimeoutMs,
            result = result,
        )
        session = newSession
        recordStep(newSession, order = 1, type = "dial", value = cleanSegments.first())
        dialUssd(activity, cleanSegments.first(), simSlot)
        scheduleTimeout("Timed out waiting for the USSD dialog.", stepTimeoutMs.toLong())

        if (cleanSegments.size == 1) {
            mainHandler.postDelayed(
                { completeSession(success = true, errorMessage = null) },
                3500L,
            )
        }
    }

    fun onAccessibilityEvent(service: AccessibilityService, event: AccessibilityEvent?) {
        val activeSession = session ?: return
        if (event == null) return

        val root = service.rootInActiveWindow ?: event.source ?: return
        val signature = collectTexts(root).joinToString("|").trim()
        if (signature.isNotEmpty() && signature == activeSession.lastSignature) {
            return
        }
        activeSession.lastSignature = signature

        if (activeSession.nextStepIndex >= activeSession.flowSegments.size) {
            completeSession(success = true, errorMessage = null)
            return
        }

        val nextValue = activeSession.flowSegments[activeSession.nextStepIndex]
        val input = findFirstNodeByClass(root, "android.widget.EditText")
        val button = findActionButton(root)

        if (input == null || button == null) {
            scheduleTimeout("Timed out waiting for the next USSD input field.", activeSession.stepTimeoutMs.toLong())
            return
        }

        mainHandler.postDelayed(
            {
                setNodeText(input, nextValue)
                button.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                val type = if (nextValue.matches(Regex("^\\d+$")) && nextValue.length <= 2) "select" else "input"
                recordStep(
                    activeSession,
                    order = activeSession.nextStepIndex + 1,
                    type = type,
                    value = nextValue,
                )
                activeSession.nextStepIndex += 1
                if (activeSession.nextStepIndex >= activeSession.flowSegments.size) {
                    mainHandler.postDelayed(
                        { completeSession(success = true, errorMessage = null) },
                        2500L,
                    )
                } else {
                    scheduleTimeout(
                        "Timed out waiting for the next USSD prompt.",
                        activeSession.stepTimeoutMs.toLong(),
                    )
                }
            },
            activeSession.perStepDelayMs.toLong(),
        )
    }

    private fun dialUssd(activity: FlutterActivity, code: String, simSlot: Int) {
        val encoded = Uri.encode(code)
        val intent = Intent(Intent.ACTION_CALL, "tel:$encoded".toUri()).apply {
            putExtra("com.android.phone.extra.slot", simSlot - 1)
            putExtra("slot", simSlot - 1)
            putExtra("slot_id", simSlot - 1)
            putExtra("simSlot", simSlot - 1)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
    }

    private fun recordStep(session: UssdSession, order: Int, type: String, value: String) {
        session.executedSteps.add(
            mapOf(
                "order" to order,
                "type" to type,
                "value" to value,
                "executedAt" to Instant.now().toString(),
                "success" to true,
            ),
        )
    }

    private fun scheduleTimeout(message: String, timeoutMs: Long) {
        val activeSession = session ?: return
        activeSession.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        activeSession.timeoutRunnable = Runnable {
            completeSession(success = false, errorMessage = message)
        }
        mainHandler.postDelayed(activeSession.timeoutRunnable!!, timeoutMs)
    }

    private fun completeSession(success: Boolean, errorMessage: String?) {
        val activeSession = session ?: return
        activeSession.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        session = null

        if (success) {
            activeSession.result.success(activeSession.executedSteps)
        } else {
            activeSession.result.error("ussd_failed", errorMessage ?: "USSD flow failed.", activeSession.executedSteps)
        }
    }

    private fun collectTexts(node: AccessibilityNodeInfo?): List<String> {
        if (node == null) {
            return emptyList()
        }
        val values = mutableListOf<String>()
        node.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let(values::add)
        for (index in 0 until node.childCount) {
            values.addAll(collectTexts(node.getChild(index)))
        }
        return values
    }

    private fun findFirstNodeByClass(node: AccessibilityNodeInfo?, className: String): AccessibilityNodeInfo? {
        if (node == null) {
            return null
        }
        if (node.className?.toString() == className) {
            return node
        }
        for (index in 0 until node.childCount) {
            val match = findFirstNodeByClass(node.getChild(index), className)
            if (match != null) {
                return match
            }
        }
        return null
    }

    private fun findActionButton(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) {
            return null
        }

        val text = node.text?.toString()?.lowercase() ?: ""
        val clickable = node.isClickable
        val isButton = node.className?.toString()?.contains("Button") == true
        if (clickable && (isButton || text in setOf("send", "ok", "reply", "yes"))) {
            return node
        }

        for (index in 0 until node.childCount) {
            val match = findActionButton(node.getChild(index))
            if (match != null) {
                return match
            }
        }
        return null
    }

    private fun setNodeText(node: AccessibilityNodeInfo, value: String) {
        val arguments = Bundle().apply {
            putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                value,
            )
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
    }
}

private data class UssdSession(
    val activity: FlutterActivity,
    val flowSegments: List<String>,
    val simSlot: Int,
    val perStepDelayMs: Int,
    val stepTimeoutMs: Int,
    val result: MethodChannel.Result,
    val executedSteps: MutableList<Map<String, Any>> = mutableListOf(),
    var nextStepIndex: Int = 1,
    var lastSignature: String = "",
    var timeoutRunnable: Runnable? = null,
)
