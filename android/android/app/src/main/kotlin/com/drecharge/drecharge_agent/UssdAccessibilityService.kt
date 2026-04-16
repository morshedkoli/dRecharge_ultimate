package com.drecharge.drecharge_agent

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class UssdAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile
        var instance: UssdAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        UssdAutomationManager.onAccessibilityEvent(this, event)
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        if (instance === this) {
            instance = null
        }
        super.onDestroy()
    }
}
