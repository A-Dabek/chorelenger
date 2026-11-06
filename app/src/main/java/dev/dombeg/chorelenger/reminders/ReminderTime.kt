package dev.dombeg.chorelenger.reminders

import dev.dombeg.chorelenger.data.Note
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.ceil

const val MIN_REMINDER_HOURS = 1
const val MAX_REMINDER_HOURS = 8_760
const val DEFAULT_REMINDER_HOURS = 24
const val SNOOZE_HOURS = 24
const val HOUR_MILLIS = 60L * 60L * 1_000L

/** Absolute trigger time for a reminder set [hours] from [now]. */
fun reminderTriggerAt(now: Long, hours: Int): Long = now + hours * HOUR_MILLIS

fun isValidReminderHours(hours: Int?): Boolean =
    hours != null && hours in MIN_REMINDER_HOURS..MAX_REMINDER_HOURS

/** Hours to pre-fill when editing; rounds up and never drops below one. */
fun remainingReminderHours(reminderAt: Long, now: Long): Int {
    val remaining = reminderAt - now
    if (remaining <= 0) return MIN_REMINDER_HOURS
    val hours = ceil(remaining.toDouble() / HOUR_MILLIS).toInt()
    return hours.coerceIn(MIN_REMINDER_HOURS, MAX_REMINDER_HOURS)
}

/** Short row badge: relative due label, text only. */
fun formatReminderDue(reminderAt: Long, now: Long): String {
    val remaining = reminderAt - now
    if (remaining <= 0) return "Overdue"
    val minutes = ceil(remaining.toDouble() / 60_000.0).toLong()
    if (minutes < 60) return "Reminder in $minutes min"
    val hours = ceil(remaining.toDouble() / HOUR_MILLIS).toInt()
    return "Reminder in $hours h"
}

private val dueFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEE, MMM d 'at' HH:mm", Locale.US)

/** Absolute due time shown in the reminder editor. */
fun formatReminderAt(
    reminderAt: Long,
    zone: ZoneId = ZoneId.systemDefault(),
): String = dueFormatter.withZone(zone).format(Instant.ofEpochMilli(reminderAt))
