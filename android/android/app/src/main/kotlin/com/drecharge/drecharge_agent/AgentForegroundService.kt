package com.drecharge.drecharge_agent

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class AgentForegroundService : Service() {

    companion object {
        const val CHANNEL_ID      = "drecharge_agent_channel"
        const val NOTIFICATION_ID = 1001
        const val NATIVE_CONFIG_PREFS = "AgentNativeConfig"
        const val KEY_BASE_URL = "agent_backend_base_url"
        const val KEY_IS_POWERED_ON = "agent_is_powered_on"
        const val KEY_JWT_TOKEN = "agent_jwt_token"
        const val KEY_DEVICE_NAME = "agent_device_name"
        const val KEY_SIM_PROVIDER = "agent_sim_provider"
        private const val POLL_INTERVAL_MS      = 15_000L
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
        private const val SMS_POLL_INTERVAL_MS  = 3_000L
        private const val WATCHDOG_INTERVAL_MS  = 60_000L   // reschedule alarm every 60 s
        private const val DEFAULT_BASE_URL      = "http://10.0.2.2:3000"

        /** Restart intent — used by AlarmManager watchdog and BootReceiver. */
        fun startIntent(context: Context) =
            Intent(context, AgentForegroundService::class.java)
    }

    // ─── Coroutine scope (cancelled on destroy, recreated on restart) ────────
    private var scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // ─── Wake locks ──────────────────────────────────────────────────────────
    /** Partial CPU wake-lock held for the life of the service (never sleeps). */
    private var cpuWakeLock: PowerManager.WakeLock? = null
    /** Screen wake-lock acquired only during job execution. */
    private var screenWakeLock: PowerManager.WakeLock? = null

    // ─── Key names mirror Flutter's backend_service.dart constants ────────────
    // ─── Lifecycle ───────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Agent running…"))
        acquireCpuWake()
        startLoops()
        scheduleWatchdog()
    }

    /**
     * START_STICKY: if the OS kills the service, it will be restarted automatically.
     * If called while already running (e.g. from watchdog / boot) we just reschedule
     * the watchdog — loops are already running.
     */
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        scheduleWatchdog()        // keep alarm alive even after a restart
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        releaseCpuWake()
        releaseScreenWake()
        // Re-schedule immediately so the OS restarts us ASAP
        scheduleWatchdog(delayMs = 5_000L)
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        scheduleWatchdog(delayMs = 5_000L)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(startIntent(this))
        } else {
            startService(startIntent(this))
        }
        super.onTaskRemoved(rootIntent)
    }

    // ─── Loop management ─────────────────────────────────────────────────────

    private fun startLoops() {
        // Cancel stale scope if this is a re-init
        scope.cancel()
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
        startPollLoop()
        startHeartbeatLoop()
    }

    // ─── Watchdog alarm ──────────────────────────────────────────────────────

    /**
     * Schedules an AlarmManager alarm that fires every [delayMs] ms.
     * On each alarm tick the BootReceiver starts/restarts this service.
     * This survives process death and battery-saver states.
     */
    private fun scheduleWatchdog(delayMs: Long = WATCHDOG_INTERVAL_MS) {
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = PendingIntent.getBroadcast(
            this,
            0,
            Intent(this, WatchdogReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val triggerAt = System.currentTimeMillis() + delayMs
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
        } catch (_: SecurityException) {
            // Some ROMs block setExactAndAllowWhileIdle without extra permission — fall back
            am.set(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    // ─── Config ──────────────────────────────────────────────────────────────

    private data class AgentConfig(
        val baseUrl: String,
        val jwtToken: String?,
        val isPoweredOn: Boolean,
        val deviceName: String,
        val simProvider: String,
    )

    private fun readConfig(): AgentConfig {
        val nativePrefs = getSharedPreferences(NATIVE_CONFIG_PREFS, MODE_PRIVATE)
        val prefs = getSharedPreferences("FlutterSharedPreferences", MODE_PRIVATE)
        val baseUrl = nativePrefs.getString(KEY_BASE_URL, null)
            ?: prefs.getString("flutter.$KEY_BASE_URL", null)
            ?: DEFAULT_BASE_URL
        val isPoweredOn = if (nativePrefs.contains(KEY_IS_POWERED_ON)) {
            nativePrefs.getBoolean(KEY_IS_POWERED_ON, true)
        } else {
            prefs.getBoolean("flutter.$KEY_IS_POWERED_ON", true)
        }
        val deviceName = nativePrefs.getString(KEY_DEVICE_NAME, null)
            ?: prefs.getString("flutter.$KEY_DEVICE_NAME", "")
            ?: ""
        val simProvider = nativePrefs.getString(KEY_SIM_PROVIDER, null)
            ?: prefs.getString("flutter.$KEY_SIM_PROVIDER", "")
            ?: ""

        val jwtToken: String? = nativePrefs.getString(KEY_JWT_TOKEN, null)?.takeIf { it.isNotBlank() } ?: try {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            val encPrefs = EncryptedSharedPreferences.create(
                "FlutterSecureStorage",
                masterKeyAlias,
                applicationContext,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            encPrefs.getString(KEY_JWT_TOKEN, null)
        } catch (_: Exception) { null }

        return AgentConfig(
            baseUrl     = baseUrl.trimEnd('/'),
            jwtToken    = jwtToken,
            isPoweredOn = isPoweredOn,
            deviceName  = deviceName,
            simProvider = simProvider,
        )
    }

    // ─── Poll loop ───────────────────────────────────────────────────────────

    private fun startPollLoop() {
        scope.launch {
            while (isActive) {
                try {
                    val config = readConfig()
                    if (config.isPoweredOn && !config.jwtToken.isNullOrBlank()) {
                        processNextJob(config)
                    }
                } catch (_: Exception) {}
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private suspend fun processNextJob(config: AgentConfig) {
        val jobJson = fetchNextJob(config) ?: return

        val jobId           = jobJson.optString("jobId").trim()
        val txId            = jobJson.optString("txId").trim()
        val serviceName     = jobJson.optString("serviceName").ifBlank { "Unknown Service" }
        val recipientNumber = jobJson.optString("recipientNumber")
        val amount          = jobJson.optDouble("amount", 0.0)
        val simSlot         = jobJson.optInt("simSlot", 1)
        val smsTimeoutSec   = jobJson.optInt("smsTimeout", 30)

        if (jobId.isBlank() || txId.isBlank()) return

        val locked = lockJob(config, jobId)
        if (!locked) return

        updateNotification("▶ $serviceName → $recipientNumber · ৳$amount")

        val startMs = System.currentTimeMillis()
        val steps   = parseUssdSteps(jobJson.optJSONArray("ussdSteps"))

        acquireScreenWake()
        delay(1_000L)

        var rawSms        = ""
        var ussdSuccess   = false
        var ussdError     = ""
        var executedSteps : List<Map<String, Any>> = emptyList()

        try {
            val ussdResult = executeUssdSuspend(steps, simSlot)
            executedSteps = ussdResult.executedSteps
            ussdSuccess   = ussdResult.success
            ussdError     = ussdResult.errorMessage ?: ""

            val smsDeadlineMs = startMs + (smsTimeoutSec * 1_000L)
            rawSms = waitForSms(smsDeadlineMs)
        } catch (e: Exception) {
            ussdError = e.message ?: "Execution error"
        } finally {
            releaseScreenWake()
        }

        val parsedResult = JSONObject().apply {
            put("success", ussdSuccess)
            if (ussdError.isNotBlank()) put("reason", ussdError)
        }

        submitResult(
            config,
            jobId,
            txId,
            serviceName,
            recipientNumber,
            amount,
            rawSms,
            parsedResult,
            executedSteps,
        )
        updateNotification("Agent running…")
    }

    // ─── USSD execution ──────────────────────────────────────────────────────

    private data class UssdExecResult(
        val success: Boolean,
        val errorMessage: String?,
        val executedSteps: List<Map<String, Any>>,
    )

    private suspend fun executeUssdSuspend(steps: List<UssdStep>, simSlot: Int): UssdExecResult =
        suspendCoroutine { cont ->
            if (steps.isEmpty()) {
                cont.resume(UssdExecResult(false, "No USSD steps configured", emptyList()))
                return@suspendCoroutine
            }
            UssdAutomationManager.executeStepsWithCallback(
                context        = applicationContext,
                steps          = steps,
                simSlot        = simSlot,
                perStepDelayMs = 1200,
                stepTimeoutMs  = 15_000,
                callback       = object : UssdExecutionCallback {
                    override fun onSuccess(executedSteps: List<Map<String, Any>>) {
                        cont.resume(UssdExecResult(true, null, executedSteps))
                    }
                    override fun onError(code: String, message: String, executedSteps: List<Map<String, Any>>) {
                        cont.resume(UssdExecResult(false, message, executedSteps))
                    }
                },
            )
        }

    // ─── SMS wait ────────────────────────────────────────────────────────────

    private suspend fun waitForSms(deadlineMs: Long): String {
        val sinceMs = System.currentTimeMillis() - 5_000L
        while (System.currentTimeMillis() < deadlineMs) {
            val messages = SmsReader.readRecentSms(applicationContext, sinceMs, 5)
            if (messages.isNotEmpty()) return messages.first()["body"] as? String ?: ""
            delay(SMS_POLL_INTERVAL_MS)
        }
        return ""
    }

    // ─── HTTP helpers ────────────────────────────────────────────────────────

    private fun fetchNextJob(config: AgentConfig): JSONObject? =
        httpGet("${config.baseUrl}/api/agent/queue", config.jwtToken)?.optJSONObject("job")

    private fun lockJob(config: AgentConfig, jobId: String): Boolean =
        httpPost("${config.baseUrl}/api/agent/queue/$jobId/lock", config.jwtToken, JSONObject())
            ?.optBoolean("acquired", false) ?: false

    private fun submitResult(
        config: AgentConfig,
        jobId: String,
        txId: String,
        serviceName: String,
        recipientNumber: String,
        amount: Double,
        rawSms: String,
        parsedResult: JSONObject,
        executedSteps: List<Map<String, Any>>,
    ) {
        val stepsArray = JSONArray()
        executedSteps.forEach { stepsArray.put(JSONObject(it)) }
        val body = JSONObject().apply {
            put("txId",               txId)
            put("serviceName",        serviceName)
            put("recipientNumber",    recipientNumber)
            put("amount",             amount)
            put("rawSms",             rawSms)
            put("parsedResult",       parsedResult)
            put("ussdStepsExecuted",  stepsArray)
        }
        httpPost("${config.baseUrl}/api/agent/queue/$jobId/result", config.jwtToken, body)
    }

    private fun sendHeartbeat(config: AgentConfig) {
        val body = JSONObject().apply {
            put("isPoweredOn", config.isPoweredOn)
            if (config.deviceName.isNotBlank())  put("name",        config.deviceName)
            if (config.simProvider.isNotBlank())  put("simProvider", config.simProvider)
        }
        httpPost("${config.baseUrl}/api/agent/heartbeat", config.jwtToken, body)
    }

    private fun httpGet(urlStr: String, token: String?): JSONObject? = try {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.setRequestProperty("Content-Type", "application/json")
        if (!token.isNullOrBlank()) conn.setRequestProperty("Authorization", "Bearer $token")
        conn.connectTimeout = 10_000
        conn.readTimeout    = 15_000
        if (conn.responseCode in 200..299)
            JSONObject(conn.inputStream.bufferedReader().readText())
        else null
    } catch (_: Exception) { null }

    private fun httpPost(urlStr: String, token: String?, body: JSONObject): JSONObject? = try {
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        if (!token.isNullOrBlank()) conn.setRequestProperty("Authorization", "Bearer $token")
        conn.connectTimeout = 10_000
        conn.readTimeout    = 15_000
        OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
        if (conn.responseCode in 200..299)
            JSONObject(conn.inputStream.bufferedReader().readText())
        else null
    } catch (_: Exception) { null }

    // ─── USSD step parsing ───────────────────────────────────────────────────

    private fun parseUssdSteps(arr: JSONArray?): List<UssdStep> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val obj = arr.optJSONObject(i) ?: return@mapNotNull null
            UssdStep(
                order  = obj.optInt("order", i),
                type   = obj.optString("type", "input"),
                label  = obj.optString("label", ""),
                value  = obj.optString("value", ""),
                waitMs = if (obj.has("waitMs")) obj.optInt("waitMs") else null,
            )
        }
    }

    // ─── Heartbeat loop ──────────────────────────────────────────────────────

    private fun startHeartbeatLoop() {
        scope.launch {
            while (isActive) {
                try {
                    val config = readConfig()
                    if (!config.jwtToken.isNullOrBlank()) sendHeartbeat(config)
                } catch (_: Exception) {}
                delay(HEARTBEAT_INTERVAL_MS)
            }
        }
    }

    // ─── Wake locks ──────────────────────────────────────────────────────────

    /** Partial wake lock — keeps the CPU awake so coroutines keep running. */
    private fun acquireCpuWake() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            cpuWakeLock?.let { if (it.isHeld) it.release() }
            cpuWakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "drecharge:cpu_keep_alive",
            ).also { it.acquire() }   // no timeout — released in onDestroy
        } catch (_: Exception) {}
    }

    private fun releaseCpuWake() {
        try { cpuWakeLock?.let { if (it.isHeld) it.release() }; cpuWakeLock = null } catch (_: Exception) {}
    }

    /** Screen wake lock — turns screen on during USSD execution. */
    @Suppress("DEPRECATION")
    private fun acquireScreenWake() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            screenWakeLock?.let { if (it.isHeld) it.release() }
            screenWakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP  or
                PowerManager.ON_AFTER_RELEASE,
                "drecharge:bg_job",
            ).also { it.acquire(90_000L) }
            startActivity(
                Intent(this, BackgroundWakeActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)
                },
            )
        } catch (_: Exception) {}
    }

    private fun releaseScreenWake() {
        try { screenWakeLock?.let { if (it.isHeld) it.release() }; screenWakeLock = null } catch (_: Exception) {}
    }

    // ─── Notification ────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "dRecharge Agent",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "dRecharge agent running in background"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(status: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pi = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("dRecharge Agent")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    fun updateNotification(status: String) {
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, buildNotification(status))
    }
}
