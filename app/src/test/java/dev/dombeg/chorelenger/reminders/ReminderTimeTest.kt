package dev.dombeg.chorelenger.reminders

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId

class ReminderTimeTest {

    private val now = 1_000_000L

    @Test
    fun triggerIsNowPlusHours() {
        assertEquals(now + 24L * HOUR_MILLIS, reminderTriggerAt(now, 24))
    }

    @Test
    fun hoursBoundsAreInclusive() {
        assertTrue(isValidReminderHours(1))
        assertTrue(isValidReminderHours(8_760))
        assertFalse(isValidReminderHours(0))
        assertFalse(isValidReminderHours(8_761))
        assertFalse(isValidReminderHours(null))
    }

    @Test
    fun remainingHoursRoundsUpWithAMinimumOfOne() {
        assertEquals(1, remainingReminderHours(now + 1L, now))
        assertEquals(2, remainingReminderHours(now + HOUR_MILLIS + 1L, now))
        assertEquals(1, remainingReminderHours(now - HOUR_MILLIS, now))
    }

    @Test
    fun dueLabelShowsFutureNearFutureAndOverdue() {
        assertEquals("Reminder in 23 h", formatReminderDue(now + 23L * HOUR_MILLIS, now))
        assertEquals("Reminder in 30 min", formatReminderDue(now + 30L * 60_000L, now))
        assertEquals("Overdue", formatReminderDue(now - 1L, now))
    }

    @Test
    fun absoluteDueDateUsesShortWeekdayMonthDayAndTime() {
        val due = java.time.ZonedDateTime.of(2024, 11, 10, 14, 30, 0, 0, ZoneId.of("UTC"))
            .toInstant()
            .toEpochMilli()

        assertEquals("Sun, Nov 10 at 14:30", formatReminderAt(due, ZoneId.of("UTC")))
    }
}
