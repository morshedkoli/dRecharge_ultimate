package com.drecharge.drecharge_agent

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telecom.TelecomManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.net.toUri
import io.flutter.plugin.common.MethodChannel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// ─── UssdStep ─────────────────────────────────────────────────────────────────

/** Mirrors the Flutter/server UssdStep model in Kotlin. */
data class UssdStep(
    val order: Int,
    val type: String,   // "dial" | "select" | "input" | "wait"
    val label: String,
    val value: String,
    val waitMs: Int? = null,
) {
    val isDial   get() = type == "dial"
    val isSelect get() = type == "select"
    val isInput  get() = type == "input"
    val isWait   get() = type == "wait"
    /** Effective wait duration in ms (falls back to parsing value string). */
    val effectiveWaitMs: Long get() = waitMs?.toLong() ?: value.toLongOrNull() ?: 1000L
}

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

    // ─── Structured step executor (MethodChannel — UI path) ─────────────────────

    fun executeSteps(
        context: Context,
        steps: List<UssdStep>,
        simSlot: Int,
        perStepDelayMs: Int,
        stepTimeoutMs: Int,
        result: MethodChannel.Result,
    ) {
        if (UssdAccessibilityService.instance == null) {
            result.error("accessibility_required",
                "Enable the dRecharge accessibility service before executing USSD flows.", null)
            return
        }
        if (session != null) {
            result.error("busy", "A USSD session is already running.", null)
            return
        }

        val dialStep = steps.firstOrNull { it.isDial }
        if (dialStep == null) {
            result.error("invalid_args", "Steps must contain at least one 'dial' step.", null)
            return
        }

        val newSession = UssdSession(
            context        = context,
            flowSegments   = steps.filter { !it.isDial && !it.isWait }.map { it.value },
            typedSteps     = steps,
            simSlot        = simSlot,
            perStepDelayMs = perStepDelayMs,
            stepTimeoutMs  = stepTimeoutMs,
            result         = result,
            callback       = null,
        )
        session = newSession
        recordStep(newSession, order = dialStep.order, type = "dial", value = dialStep.value)
        dialUssd(context, dialStep.value, simSlot)
        scheduleTimeout("Timed out waiting for the USSD dialog.", stepTimeoutMs.toLong())

        val interactionSteps = steps.filter { !it.isDial }
        if (interactionSteps.isEmpty()) {
            mainHandler.postDelayed(
                { completeSession(success = true, errorMessage = null) },
                3500L,
            )
        }
    }

    // ─── Structured step executor (Callback — background service path) ───────────

    fun executeStepsWithCallback(
        context: Context,
        steps: List<UssdStep>,
        simSlot: Int,
        perStepDelayMs: Int = 1200,
        stepTimeoutMs: Int = 15000,
        callback: UssdExecutionCallback,
    ) {
        if (UssdAccessibilityService.instance == null) {
            callback.onError("accessibility_required",
                "Enable the dRecharge accessibility service before executing USSD flows.", emptyList())
            return
        }
        if (session != null) {
            callback.onError("busy", "A USSD session is already running.", emptyList())
            return
        }

        val dialStep = steps.firstOrNull { it.isDial }
        if (dialStep == null) {
            callback.onError("invalid_args", "Steps must contain at least one 'dial' step.", emptyList())
            return
        }

        val newSession = UssdSession(
            context        = context,
            flowSegments   = steps.filter { !it.isDial && !it.isWait }.map { it.value },
            typedSteps     = steps,
            simSlot        = simSlot,
            perStepDelayMs = perStepDelayMs,
            stepTimeoutMs  = stepTimeoutMs,
            result         = null,
            callback       = callback,
        )
        session = newSession
        recordStep(newSession, order = dialStep.order, type = "dial", value = dialStep.value)
        dialUssd(context, dialStep.value, simSlot)
        scheduleTimeout("Timed out waiting for the USSD dialog.", stepTimeoutMs.toLong())

        val interactionSteps = steps.filter { !it.isDial }
        if (interactionSteps.isEmpty()) {
            mainHandler.postDelayed(
                { completeSession(success = true, errorMessage = null) },
                3500L,
            )
        }
    }

    // ─── Legacy flow executor ────────────────────────────────────────────────────

    fun executeFlow(
        context: Context,
        flowSegments: List<String>,
        simSlot: Int,
        perStepDelayMs: Int,
        stepTimeoutMs: Int,
        result: MethodChannel.Result,
    ) {
        if (UssdAccessibilityService.instance == null) {
            result.error("accessibility_required",
                "Enable the dRecharge accessibility service before executing USSD flows.", null)
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

        val dialValue = cleanSegments.first()
        val interactionSegments = if (cleanSegments.size > 1) cleanSegments.drop(1) else emptyList()

        val newSession = UssdSession(
            context        = context,
            flowSegments   = interactionSegments,
            typedSteps     = null,
            simSlot        = simSlot,
            perStepDelayMs = perStepDelayMs,
            stepTimeoutMs  = stepTimeoutMs,
            result         = result,
            callback       = null,
        )
        session = newSession
        recordStep(newSession, order = 1, type = "dial", value = dialValue)
        dialUssd(context, dialValue, simSlot)
        scheduleTimeout("Timed out waiting for the USSD dialog.", stepTimeoutMs.toLong())

        if (interactionSegments.isEmpty()) {
            mainHandler.postDelayed(
                { completeSession(success = true, errorMessage = null) },
                3500L,
            )
        }
    }

    fun onAccessibilityEvent(service: AccessibilityService, event: AccessibilityEvent?) {
        val activeSession = session ?: return
        if (event == null) return

        if (activeSession.isProcessingStep) return

        val root = service.rootInActiveWindow ?: event.source ?: return

        // ── SIM picker auto-dismiss ───────────────────────────────────────────────
        if (findFirstNodeByClass(root, "android.widget.EditText") == null) {
            val simButton = findSimButton(root, activeSession.simSlot)
            if (simButton != null) {
                simButton.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                scheduleTimeout(
                    "Timed out waiting for the USSD dialog after SIM pick.",
                    activeSession.stepTimeoutMs.toLong(),
                )
                return
            }
        }

        val signature = collectTexts(root).joinToString("|").trim()
        if (signature.isNotEmpty() && signature == activeSession.lastSignature) return
        activeSession.lastSignature = signature

        if (activeSession.nextStepIndex >= activeSession.flowSegments.size) {
            completeSession(success = true, errorMessage = null)
            return
        }

        val nextValue = activeSession.flowSegments[activeSession.nextStepIndex]

        val interactionSteps = activeSession.typedSteps
            ?.filter { !it.isDial }
            ?: emptyList()

        val currentInteractionStep = interactionSteps
            .filter { !it.isWait }
            .getOrNull(activeSession.nextStepIndex)

        val input  = findFirstNodeByClass(root, "android.widget.EditText")
        val button = findActionButton(root)

        if (input == null || button == null) {
            scheduleTimeout("Timed out waiting for the next USSD input field.", activeSession.stepTimeoutMs.toLong())
            return
        }

        activeSession.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        activeSession.isProcessingStep = true

        val nextTypedIndex = (activeSession.typedStepCursor)
        val nextTypedStep  = activeSession.typedSteps?.getOrNull(nextTypedIndex)
        val waitBefore     = if (nextTypedStep?.isWait == true) nextTypedStep.effectiveWaitMs else 0L

        val delayMs = if (waitBefore > 0L) waitBefore else activeSession.perStepDelayMs.toLong()
        if (waitBefore > 0L) {
            activeSession.typedStepCursor++
        }

        mainHandler.postDelayed(
            {
                val s = session
                if (s == null || s !== activeSession) return@postDelayed

                val freshRoot   = service.rootInActiveWindow
                val freshInput  = freshRoot?.let { findFirstNodeByClass(it, "android.widget.EditText") }
                val freshButton = freshRoot?.let { findActionButton(it) }

                if (freshInput == null || freshButton == null) {
                    activeSession.isProcessingStep = false
                    activeSession.lastSignature = ""
                    scheduleTimeout(
                        "USSD prompt disappeared before input could be filled.",
                        activeSession.stepTimeoutMs.toLong(),
                    )
                    return@postDelayed
                }

                setNodeText(freshInput, nextValue)
                freshButton.performAction(AccessibilityNodeInfo.ACTION_CLICK)

                val stepType = currentInteractionStep?.type
                    ?: if (nextValue.matches(Regex("^\\d+$")) && nextValue.length <= 2) "select" else "input"

                recordStep(
                    activeSession,
                    order = activeSession.nextStepIndex + 2,
                    type  = stepType,
                    value = nextValue,
                )

                activeSession.nextStepIndex++
                activeSession.typedStepCursor++

                val afterTyped = activeSession.typedSteps?.getOrNull(activeSession.typedStepCursor)
                if (afterTyped?.isWait == true) {
                    recordStep(activeSession, order = afterTyped.order, type = "wait", value = afterTyped.value)
                    activeSession.typedStepCursor++
                }

                activeSession.isProcessingStep = false
                activeSession.lastSignature = ""

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
            delayMs,
        )
    }

    @Suppress("MissingPermission")
    private fun dialUssd(context: Context, code: String, simSlot: Int) {
        val uri = Uri.encode(code).let { "tel:$it".toUri() }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val telecom = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            if (telecom != null) {
                try {
                    val accounts = telecom.callCapablePhoneAccounts
                    val targetIndex = (simSlot - 1).coerceAtLeast(0)
                    val handle = accounts.getOrNull(targetIndex) ?: accounts.firstOrNull()
                    if (handle != null) {
                        val extras = Bundle().apply {
                            putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle)
                        }
                        telecom.placeCall(uri, extras)
                        return
                    }
                } catch (_: Exception) {
                    // Permission denied or no accounts — fall through to intent
                }
            }
        }

        // Fallback: Intent with OEM slot extras — always add NEW_TASK so it works from Service too
        val intent = Intent(Intent.ACTION_CALL, uri).apply {
            putExtra("com.android.phone.extra.slot", simSlot - 1)
            putExtra("slot", simSlot - 1)
            putExtra("slot_id", simSlot - 1)
            putExtra("simSlot", simSlot - 1)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun recordStep(session: UssdSession, order: Int, type: String, value: String) {
        val iso8601 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        session.executedSteps.add(
            mapOf(
                "order"      to order,
                "type"       to type,
                "value"      to value,
                "executedAt" to iso8601,
                "success"    to true,
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
        activeSession.isProcessingStep = false
        session = null

        if (success) {
            activeSession.result?.success(activeSession.executedSteps)
            activeSession.callback?.onSuccess(activeSession.executedSteps)
        } else {
            val msg = errorMessage ?: "USSD flow failed."
            activeSession.result?.error("ussd_failed", msg, activeSession.executedSteps)
            activeSession.callback?.onError("ussd_failed", msg, activeSession.executedSteps)
        }
    }

    private fun collectTexts(node: AccessibilityNodeInfo?): List<String> {
        if (node == null) return emptyList()
        val values = mutableListOf<String>()
        node.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let(values::add)
        for (index in 0 until node.childCount) {
            values.addAll(collectTexts(node.getChild(index)))
        }
        return values
    }

    private fun findFirstNodeByClass(node: AccessibilityNodeInfo?, className: String): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.className?.toString() == className) return node
        for (index in 0 until node.childCount) {
            val match = findFirstNodeByClass(node.getChild(index), className)
            if (match != null) return match
        }
        return null
    }

    private fun findActionButton(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        val buttons = mutableListOf<AccessibilityNodeInfo>()
        collectAllButtons(node, buttons)
        if (buttons.isEmpty()) return null

        val positiveLabels = setOf("send", "ok", "reply", "yes", "submit", "continue", "next")
        val negativeLabels = setOf("cancel", "dismiss", "no", "close", "back", "exit")

        for (btn in buttons) {
            val text = (btn.text?.toString() ?: btn.contentDescription?.toString() ?: "").trim().lowercase()
            if (text in positiveLabels) return btn
        }
        val nonNegative = buttons.filter { btn ->
            val text = (btn.text?.toString() ?: btn.contentDescription?.toString() ?: "").trim().lowercase()
            text !in negativeLabels
        }
        if (nonNegative.isNotEmpty()) return nonNegative.last()
        return buttons.last()
    }

    private fun collectAllButtons(node: AccessibilityNodeInfo?, result: MutableList<AccessibilityNodeInfo>) {
        if (node == null) return
        if (node.isClickable &&
            (node.className?.toString()?.contains("Button") == true ||
                node.className?.toString()?.contains("TextView") == true)
        ) {
            result.add(node)
        }
        for (i in 0 until node.childCount) {
            collectAllButtons(node.getChild(i), result)
        }
    }

    private fun findSimButton(root: AccessibilityNodeInfo, simSlot: Int): AccessibilityNodeInfo? {
        val simIndex = simSlot - 1
        val clickableButtons = mutableListOf<AccessibilityNodeInfo>()
        collectAllButtons(root, clickableButtons)
        if (clickableButtons.isEmpty()) return null

        val labelPatterns = listOf(
            Regex("sim\\s*$simSlot", RegexOption.IGNORE_CASE),
            Regex("slot\\s*$simSlot", RegexOption.IGNORE_CASE),
            Regex("card\\s*$simSlot", RegexOption.IGNORE_CASE),
        )
        for (btn in clickableButtons) {
            val txt = btn.text?.toString() ?: btn.contentDescription?.toString() ?: continue
            if (labelPatterns.any { it.containsMatchIn(txt) }) return btn
        }
        if (simIndex < clickableButtons.size && clickableButtons.size <= 3) {
            return clickableButtons[simIndex]
        }
        return null
    }

    private fun setNodeText(node: AccessibilityNodeInfo, value: String) {
        val arguments = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
    }
}

private data class UssdSession(
    val context: Context,
    val flowSegments: List<String>,
    val typedSteps: List<UssdStep>?,
    val simSlot: Int,
    val perStepDelayMs: Int,
    val stepTimeoutMs: Int,
    val result: MethodChannel.Result?,
    val callback: UssdExecutionCallback?,
    val executedSteps: MutableList<Map<String, Any>> = mutableListOf(),
    var nextStepIndex: Int = 0,
    var typedStepCursor: Int = 1,
    var lastSignature: String = "",
    var timeoutRunnable: Runnable? = null,
    var isProcessingStep: Boolean = false,
)
