package dev.dombeg.chorelenger.reminders

import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Pure recurrence math; no Android dependencies. */
class RecurrenceTest {

    private val zone = ZoneId.of("Europe/Warsaw")

    private fun at(
        year: Int,
        month: Int,
        day: Int,
        hour: Int,
        minute: Int = 0,
    ): Long = ZonedDateTime.of(year, month, day, hour, minute, 0, 0, zone)
        .toInstant()
        .toEpochMilli()

    private fun localDate(millis: Long): String =
        Instant.ofEpochMilli(millis).atZone(zone).toLocalDate().toString()

    private fun localHour(millis: Long): Int =
        Instant.ofEpochMilli(millis).atZone(zone).hour

    @Test
    fun relativeDaysCountFromCompletion() {
        val completedAt = at(2026, 5, 10, 12)

        val next = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.DAYS, 2, RecurrenceMode.RELATIVE),
            previousDueAt = at(2026, 5, 1, 9),
            completedAt = completedAt,
            zone = zone,
        )

        assertEquals(at(2026, 5, 12, 12), next)
    }

    @Test
    fun relativeWeeksCountFromCompletion() {
        val completedAt = at(2026, 5, 10, 12)

        val next = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.WEEKS, 5, RecurrenceMode.RELATIVE),
            previousDueAt = at(2026, 4, 1, 9),
            completedAt = completedAt,
            zone = zone,
        )

        assertEquals(at(2026, 6, 14, 12), next)
    }

    @Test
    fun relativeMonthsCountFromCompletionAndClampAtMonthEnd() {
        val next = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.MONTHS, 1, RecurrenceMode.RELATIVE),
            previousDueAt = at(2026, 1, 1, 9),
            completedAt = at(2026, 1, 31, 12),
            zone = zone,
        )

        assertEquals(at(2026, 2, 28, 12), next)
    }

    @Test
    fun absoluteDaysAddOneIntervalFromPreviousDue() {
        val next = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.DAYS, 2, RecurrenceMode.ABSOLUTE),
            previousDueAt = at(2026, 5, 1, 9),
            completedAt = at(2026, 5, 1, 10),
            zone = zone,
        )

        assertEquals(at(2026, 5, 3, 9), next)
    }

    @Test
    fun absoluteWeeksKeepTheSameWeekdayAndTime() {
        val next = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.WEEKS, 1, RecurrenceMode.ABSOLUTE),
            previousDueAt = at(2026, 5, 3, 9),
            completedAt = at(2026, 5, 6, 18),
            zone = zone,
        )

        assertEquals(at(2026, 5, 10, 9), next)
    }

    @Test
    fun absoluteLateCompletionSkipsEveryPastOccurrence() {
        val next = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.DAYS, 2, RecurrenceMode.ABSOLUTE),
            previousDueAt = at(2026, 1, 1, 9),
            completedAt = at(2026, 1, 10, 12),
            zone = zone,
        )

        assertEquals(at(2026, 1, 11, 9), next)
    }

    @Test
    fun monthEndClampsThenDriftsFromTheClampedDate() {
        val first = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.MONTHS, 1, RecurrenceMode.ABSOLUTE),
            previousDueAt = at(2026, 1, 31, 9),
            completedAt = at(2026, 2, 1, 12),
            zone = zone,
        )
        val second = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.MONTHS, 1, RecurrenceMode.ABSOLUTE),
            previousDueAt = first,
            completedAt = at(2026, 2, 28, 10),
            zone = zone,
        )

        assertEquals(at(2026, 2, 28, 9), first)
        assertEquals(at(2026, 3, 28, 9), second)
    }

    @Test
    fun dstTransitionKeepsTheLocalWallClockTime() {
        // Europe/Warsaw springs forward at 02:00 on 2026-03-29.
        val next = nextOccurrence(
            RecurrenceSpec(RecurrenceUnit.DAYS, 1, RecurrenceMode.ABSOLUTE),
            previousDueAt = at(2026, 3, 28, 9),
            completedAt = at(2026, 3, 28, 9),
            zone = zone,
        )

        assertEquals("2026-03-29", localDate(next))
        assertEquals(9, localHour(next))
    }

    @Test
    fun descriptionsMatchTheCountingMode() {
        assertEquals(
            "Every 2 weeks",
            recurrenceLabel(RecurrenceSpec(RecurrenceUnit.WEEKS, 2, RecurrenceMode.ABSOLUTE)),
        )
        assertEquals(
            "Every 1 month",
            recurrenceLabel(RecurrenceSpec(RecurrenceUnit.MONTHS, 1, RecurrenceMode.ABSOLUTE)),
        )
        assertEquals(
            "2 weeks after done",
            recurrenceLabel(RecurrenceSpec(RecurrenceUnit.WEEKS, 2, RecurrenceMode.RELATIVE)),
        )
        assertEquals(
            "1 month after done",
            recurrenceLabel(RecurrenceSpec(RecurrenceUnit.MONTHS, 1, RecurrenceMode.RELATIVE)),
        )
    }

    @Test
    fun countValidationUsesUnitSpecificBounds() {
        assertTrue(isValidRecurrenceCount(RecurrenceUnit.DAYS, 1))
        assertTrue(isValidRecurrenceCount(RecurrenceUnit.DAYS, 365))
        assertFalse(isValidRecurrenceCount(RecurrenceUnit.DAYS, 0))
        assertFalse(isValidRecurrenceCount(RecurrenceUnit.DAYS, 366))
        assertTrue(isValidRecurrenceCount(RecurrenceUnit.WEEKS, 52))
        assertFalse(isValidRecurrenceCount(RecurrenceUnit.WEEKS, 53))
        assertTrue(isValidRecurrenceCount(RecurrenceUnit.MONTHS, 24))
        assertFalse(isValidRecurrenceCount(RecurrenceUnit.MONTHS, 25))
        assertFalse(isValidRecurrenceCount(RecurrenceUnit.DAYS, null))
    }

    @Test
    fun firstExecutionMustBeStrictlyInTheFuture() {
        val now = at(2026, 5, 10, 12)

        assertTrue(isValidFirstExecution(now + 1, now))
        assertFalse(isValidFirstExecution(now, now))
        assertFalse(isValidFirstExecution(now - 1, now))
        assertFalse(isValidFirstExecution(null, now))
    }

    @Test
    fun defaultFirstExecutionPrefersAFutureExistingDue() {
        val now = at(2026, 5, 10, 12)
        val existing = at(2026, 5, 12, 9)

        assertEquals(existing, defaultFirstExecution(existing, now, zone))
        assertEquals(at(2026, 5, 11, 12), defaultFirstExecution(null, now, zone))
    }

    @Test
    fun noteRecurrenceSpecRequiresEveryColumn() {
        val periodic = Note(
            text = "water plants",
            recurrenceUnit = RecurrenceUnit.DAYS,
            recurrenceCount = 2,
            recurrenceMode = RecurrenceMode.RELATIVE,
        )
        assertEquals(
            RecurrenceSpec(RecurrenceUnit.DAYS, 2, RecurrenceMode.RELATIVE),
            periodic.recurrenceSpec,
        )

        assertNull(periodic.copy(recurrenceCount = null).recurrenceSpec)
        assertNull(periodic.copy(recurrenceMode = null).recurrenceSpec)
        assertNull(Note(text = "plain").recurrenceSpec)
    }
}
