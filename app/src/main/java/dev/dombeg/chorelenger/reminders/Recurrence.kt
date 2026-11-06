package dev.dombeg.chorelenger.reminders

import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import java.time.Instant
import java.time.ZoneId

/** Unit, interval size and counting mode for a periodic reminder. */
data class RecurrenceSpec(
    val unit: RecurrenceUnit,
    val count: Int,
    val mode: RecurrenceMode,
)

/** The recurrence carried by a note, or null when the note is not periodic. */
val Note.recurrenceSpec: RecurrenceSpec?
    get() {
        val unit = recurrenceUnit ?: return null
        val count = recurrenceCount ?: return null
        val mode = recurrenceMode ?: return null
        return RecurrenceSpec(unit, count, mode)
    }

/**
 * The next due time after [completedAt].
 *
 * ABSOLUTE keeps adding the interval to [previousDueAt] until the result is
 * strictly after [completedAt], so every missed occurrence is skipped.
 * RELATIVE simply counts the interval from [completedAt].
 */
fun nextOccurrence(
    spec: RecurrenceSpec,
    previousDueAt: Long,
    completedAt: Long,
    zone: ZoneId = ZoneId.systemDefault(),
): Long = when (spec.mode) {
    RecurrenceMode.ABSOLUTE -> {
        var next = previousDueAt
        do {
            next = addUnits(next, spec.unit, spec.count, zone)
        } while (next <= completedAt)
        next
    }
    RecurrenceMode.RELATIVE -> addUnits(completedAt, spec.unit, spec.count, zone)
}

/**
 * Calendar arithmetic on the local wall-clock time, so DST transitions keep
 * the same hour of day. Month-end dates clamp (`Jan 31 + 1 month = Feb 28`).
 */
fun addUnits(
    base: Long,
    unit: RecurrenceUnit,
    count: Int,
    zone: ZoneId = ZoneId.systemDefault(),
): Long {
    val local = Instant.ofEpochMilli(base).atZone(zone)
    val next = when (unit) {
        RecurrenceUnit.DAYS -> local.plusDays(count.toLong())
        RecurrenceUnit.WEEKS -> local.plusWeeks(count.toLong())
        RecurrenceUnit.MONTHS -> local.plusMonths(count.toLong())
    }
    return next.toInstant().toEpochMilli()
}

val RecurrenceUnit.maxCount: Int
    get() = when (this) {
        RecurrenceUnit.DAYS -> 365
        RecurrenceUnit.WEEKS -> 52
        RecurrenceUnit.MONTHS -> 24
    }

fun isValidRecurrenceCount(unit: RecurrenceUnit, count: Int?): Boolean =
    count != null && count in 1..unit.maxCount

fun isValidFirstExecution(firstAt: Long?, now: Long): Boolean =
    firstAt != null && firstAt > now

/** Tomorrow at the same local time, unless the existing due time is still ahead. */
fun defaultFirstExecution(
    existingReminderAt: Long?,
    now: Long,
    zone: ZoneId = ZoneId.systemDefault(),
): Long {
    if (existingReminderAt != null && existingReminderAt > now) return existingReminderAt
    return Instant.ofEpochMilli(now).atZone(zone).plusDays(1).toInstant().toEpochMilli()
}

/** UI label: `Every 2 weeks` or `2 weeks after done`. */
fun recurrenceLabel(spec: RecurrenceSpec): String {
    val amount = "${spec.count} ${unitLabel(spec.unit, spec.count)}"
    return when (spec.mode) {
        RecurrenceMode.ABSOLUTE -> "Every $amount"
        RecurrenceMode.RELATIVE -> "$amount after done"
    }
}

fun unitLabel(unit: RecurrenceUnit, count: Int): String {
    val singular = count == 1
    return when (unit) {
        RecurrenceUnit.DAYS -> if (singular) "day" else "days"
        RecurrenceUnit.WEEKS -> if (singular) "week" else "weeks"
        RecurrenceUnit.MONTHS -> if (singular) "month" else "months"
    }
}
