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
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.MethodChannel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

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

        // Skip all events while we're mid-step (delay is pending or filling the field).
        // This prevents duplicate events or a closing dialog from triggering the next step early.
        if (activeSession.isProcessingStep) return

        val root = service.rootInActiveWindow ?: event.source ?: return

        // ── SIM picker auto-dismiss (fallback) ───────────────────────────────────────
        // Some OEM ROMs still show a SIM picker even when TelecomManager.placeCall()
        // is used. Detect it: a dialog with clickable SIM buttons but NO EditText
        // (EditText only appears in a real USSD prompt screen).
        if (findFirstNodeByClass(root, "android.widget.EditText") == null) {
            val simButton = findSimButton(root, activeSession.simSlot)
            if (simButton != null) {
                simButton.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                // Reset timeout so the USSD dialog has time to appear after SIM pick.
                scheduleTimeout(
                    "Timed out waiting for the USSD dialog after SIM pick.",
                    activeSession.stepTimeoutMs.toLong(),
                )
                return
            }
        }
        // ─────────────────────────────────────────────────────────────────────────────

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

        // Valid USSD prompt detected — cancel the running timeout and lock step processing.
        activeSession.timeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        activeSession.isProcessingStep = true

        mainHandler.postDelayed(
            {
                val s = session
                if (s == null || s !== activeSession) return@postDelayed

                // Re-fetch nodes: refs captured at event time may be stale after the delay.
                val freshRoot = service.rootInActiveWindow
                val freshInput = freshRoot?.let { findFirstNodeByClass(it, "android.widget.EditText") }
                val freshButton = freshRoot?.let { findActionButton(it) }

                if (freshInput == null || freshButton == null) {
                    // Prompt disappeared during delay (e.g. USSD self-advanced or network timeout).
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

                val type = if (nextValue.matches(Regex("^\\d+$")) && nextValue.length <= 2) "select" else "input"
                recordStep(
                    activeSession,
                    order = activeSession.nextStepIndex + 1,
                    type = type,
                    value = nextValue,
                )
                activeSession.nextStepIndex += 1
                activeSession.isProcessingStep = false
                // Clear lastSignature so the next prompt is processed even if its text
                // matches the previous one (e.g. two consecutive "Enter amount" screens).
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
            activeSession.perStepDelayMs.toLong(),
        )
    }

    /**
     * Dial a USSD code on [simSlot] (1-based) without showing the SIM picker dialog.
     *
     * Strategy:
     *  1. TelecomManager.placeCall() with the PhoneAccountHandle matching [simSlot]
     *     index — the only cross-OEM way to bypass the picker reliably.
     *  2. Intent.ACTION_CALL with OEM slot extras as a fallback for very old ROMs or
     *     emulators where TelecomManager accounts are unavailable.
     */
    @Suppress("MissingPermission")
    private fun dialUssd(activity: FlutterActivity, code: String, simSlot: Int) {
        val uri = Uri.encode(code).let { "tel:$it".toUri() }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val telecom = activity.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            if (telecom != null) {
                try {
                    val accounts = telecom.callCapablePhoneAccounts
                    // simSlot is 1-based; account list is ordered by SIM slot index.
                    val targetIndex = (simSlot - 1).coerceAtLeast(0)
                    val handle = accounts.getOrNull(targetIndex) ?: accounts.firstOrNull()
                    if (handle != null) {
                        val extras = Bundle().apply {
                            putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, handle)
                        }
                        telecom.placeCall(uri, extras)
                        return // ✅ SIM picker will NOT appear
                    }
                } catch (_: Exception) {
                    // Permission denied or no accounts — fall through to intent
                }
            }
        }

        // Fallback: Intent with OEM slot extras (may still show picker on some ROMs,
        // but the accessibility handler above will auto-click the correct SIM button).
        val intent = Intent(Intent.ACTION_CALL, uri).apply {
            putExtra("com.android.phone.extra.slot", simSlot - 1)
            putExtra("slot", simSlot - 1)
            putExtra("slot_id", simSlot - 1)
            putExtra("simSlot", simSlot - 1)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
    }

    private fun recordStep(session: UssdSession, order: Int, type: String, value: String) {
        val iso8601 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        session.executedSteps.add(
            mapOf(
                "order" to order,
                "type" to type,
                "value" to value,
                "executedAt" to iso8601,
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
        activeSession.isProcessingStep = false
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

    /**
     * Finds the "Send" / "OK" action button in a USSD dialog.
     *
     * USSD dialogs typically show two buttons: Cancel (left) and Send (right).
     * Strategy:
     *  1. Collect every clickable button-like node in the tree.
     *  2. Prefer one whose text matches positive labels (send, ok, reply, yes).
     *  3. Explicitly skip negative labels (cancel, dismiss, no, close, back).
     *  4. Fallback: pick the LAST button — on most Android UIs the positive
     *     action sits on the right, which is the last child in the layout.
     */
    private fun findActionButton(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null

        val buttons = mutableListOf<AccessibilityNodeInfo>()
        collectAllButtons(node, buttons)
        if (buttons.isEmpty()) return null

        val positiveLabels = setOf("send", "ok", "reply", "yes", "submit", "continue", "next")
        val negativeLabels = setOf("cancel", "dismiss", "no", "close", "back", "exit")

        // First pass: look for a button with a positive label.
        for (btn in buttons) {
            val text = (btn.text?.toString() ?: btn.contentDescription?.toString() ?: "")
                .trim().lowercase()
            if (text in positiveLabels) return btn
        }

        // Second pass: filter out negative-labeled buttons, take the last remaining one.
        val nonNegative = buttons.filter { btn ->
            val text = (btn.text?.toString() ?: btn.contentDescription?.toString() ?: "")
                .trim().lowercase()
            text !in negativeLabels
        }
        if (nonNegative.isNotEmpty()) return nonNegative.last()

        // Absolute fallback: return the rightmost (last) button.
        return buttons.last()
    }

    /**
     * Collects all clickable Button/TextView nodes from the accessibility tree.
     * Used by both [findActionButton] and [findSimButton].
     */
    private fun collectAllButtons(
        node: AccessibilityNodeInfo?,
        result: MutableList<AccessibilityNodeInfo>,
    ) {
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

    /**
     * Finds the button for [simSlot] (1-based) inside a SIM picker dialog.
     *
     * Matching order:
     *  1. Text/content-description matches "SIM 1", "SIM 2", "Slot 1", "Card 1" etc.
     *  2. Positional fallback — clicks the Nth (0-indexed) clickable button.
     *
     * Returns null if no SIM picker is detected (i.e. not a picker screen or no buttons).
     */
    private fun findSimButton(root: AccessibilityNodeInfo, simSlot: Int): AccessibilityNodeInfo? {
        val simIndex = simSlot - 1 // 0-based
        val clickableButtons = mutableListOf<AccessibilityNodeInfo>()
        collectAllButtons(root, clickableButtons)

        if (clickableButtons.isEmpty()) return null

        // 1. Label match: "SIM 1", "SIM 2", "Slot 1", "Card 1", etc.
        val labelPatterns = listOf(
            Regex("sim\\s*$simSlot", RegexOption.IGNORE_CASE),
            Regex("slot\\s*$simSlot", RegexOption.IGNORE_CASE),
            Regex("card\\s*$simSlot", RegexOption.IGNORE_CASE),
        )
        for (btn in clickableButtons) {
            val txt = btn.text?.toString() ?: btn.contentDescription?.toString() ?: continue
            if (labelPatterns.any { it.containsMatchIn(txt) }) return btn
        }

        // 2. Positional fallback: click the Nth button (0-indexed)
        if (simIndex < clickableButtons.size && clickableButtons.size <= 3) {
            // Only use positional match when there are ≤3 buttons to avoid false-positives
            // on real USSD dialogs that have multiple action buttons.
            return clickableButtons[simIndex]
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
    var isProcessingStep: Boolean = false,
)
