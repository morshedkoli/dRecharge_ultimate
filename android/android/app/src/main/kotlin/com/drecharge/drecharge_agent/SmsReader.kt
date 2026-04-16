package com.drecharge.drecharge_agent

import android.content.Context
import android.provider.Telephony

object SmsReader {
    fun readRecentSms(context: Context, sinceMs: Long, maxMessages: Int): List<Map<String, Any>> {
        val messages = mutableListOf<Map<String, Any>>()
        val projection = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
        )
        val selection = "${Telephony.Sms.DATE} >= ?"
        val args = arrayOf(sinceMs.toString())
        val sortOrder = "${Telephony.Sms.DATE} DESC"

        context.contentResolver.query(
            Telephony.Sms.Inbox.CONTENT_URI,
            projection,
            selection,
            args,
            sortOrder,
        )?.use { cursor ->
            val addressIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
            val bodyIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
            val dateIndex = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)

            while (cursor.moveToNext() && messages.size < maxMessages) {
                messages.add(
                    mapOf(
                        "address" to (cursor.getString(addressIndex) ?: ""),
                        "body" to (cursor.getString(bodyIndex) ?: ""),
                        "dateMs" to cursor.getLong(dateIndex),
                    ),
                )
            }
        }

        return messages
    }
}
