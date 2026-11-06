package dev.dombeg.chorelenger.reminders

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import java.time.Instant
import java.time.ZoneId
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Integration test: real Room, fake Android seams, controllable clock. */
@RunWith(AndroidJUnit4::class)
class ReminderActionsTest {

    private lateinit var db: AppDatabase
    private lateinit var dao: NoteDao
    private lateinit var scheduler: FakeReminderScheduler
    private lateinit var notifier: FakeReminderNotifier
    private lateinit var actions: ReminderActions
    private var now = 1_000_000L
    private val zone = ZoneId.of("UTC")

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).allowMainThreadQueries().build()
        dao = db.noteDao()
        scheduler = FakeReminderScheduler()
        notifier = FakeReminderNotifier()
        actions = ReminderActions(dao, scheduler, notifier, now = { now }, zone = zone)
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun utc(text: String): Long = Instant.parse(text).toEpochMilli()

    private suspend fun insertReminder(
        due: Long,
        notifiedAt: Long? = null,
    ): Long = dao.insert(
        Note(
            text = "walk the dog",
            createdAt = 1L,
            reminderAt = due,
            reminderNotifiedAt = notifiedAt,
        ),
    )

    private suspend fun insertPeriodic(
        due: Long,
        unit: RecurrenceUnit = RecurrenceUnit.DAYS,
        count: Int = 1,
        mode: RecurrenceMode = RecurrenceMode.ABSOLUTE,
        notifiedAt: Long? = null,
    ): Long = dao.insert(
        Note(
            text = "water plants",
            createdAt = 1L,
            reminderAt = due,
            reminderNotifiedAt = notifiedAt,
            recurrenceUnit = unit,
            recurrenceCount = count,
            recurrenceMode = mode,
        ),
    )

    @Test
    fun setOneTimeReminderPersistsSchedulesAndCancelsStaleNotification() = runTest {
        val id = dao.insert(Note(text = "walk", createdAt = 1L))

        actions.setOneTimeReminder(id, 5_000L)

        assertEquals(5_000L, dao.getById(id)!!.reminderAt)
        assertEquals(5_000L, scheduler.scheduled[id])
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun setPeriodicReminderPersistsAllFieldsAndSchedulesFirstDue() = runTest {
        val id = dao.insert(Note(text = "walk", createdAt = 1L))

        actions.setPeriodicReminder(id, 5_000L, RecurrenceUnit.WEEKS, 2, RecurrenceMode.RELATIVE)

        val note = dao.getById(id)!!
        assertEquals(5_000L, note.reminderAt)
        assertEquals(RecurrenceUnit.WEEKS, note.recurrenceUnit)
        assertEquals(2, note.recurrenceCount)
        assertEquals(RecurrenceMode.RELATIVE, note.recurrenceMode)
        assertEquals(5_000L, scheduler.scheduled[id])
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun alarmFiredShowsNotificationOnceAndMarksNotified() = runTest {
        val id = insertReminder(due = now)

        actions.onAlarmFired(id)

        assertEquals(1, notifier.shown.size)
        assertEquals(id, notifier.shown.first().id)
        assertEquals(now, dao.getById(id)!!.reminderNotifiedAt)

        actions.onAlarmFired(id)

        assertEquals(1, notifier.shown.size)
    }

    @Test
    fun staleAlarmReschedulesCurrentDueTimeWithoutNotifying() = runTest {
        val id = insertReminder(due = now + HOUR_MILLIS)

        actions.onAlarmFired(id)

        assertTrue(notifier.shown.isEmpty())
        assertEquals(now + HOUR_MILLIS, scheduler.scheduled[id])
        assertNull(dao.getById(id)!!.reminderNotifiedAt)
    }

    @Test
    fun alarmForMissingOrOrdinaryNoteDoesNothing() = runTest {
        val ordinary = dao.insert(Note(text = "plain", createdAt = 1L))

        actions.onAlarmFired(ordinary)
        actions.onAlarmFired(999L)

        assertTrue(notifier.shown.isEmpty())
    }

    @Test
    fun rescheduleAllDeliversPastDueReminderImmediately() = runTest {
        val id = insertReminder(due = now - HOUR_MILLIS)

        actions.rescheduleAll()

        assertEquals(now + 1_000L, scheduler.scheduled[id])
    }

    @Test
    fun rescheduleAllReArmsFuturePeriodicReminder() = runTest {
        val due = now + HOUR_MILLIS
        val id = insertPeriodic(due = due, unit = RecurrenceUnit.WEEKS, count = 2)

        actions.rescheduleAll()

        assertEquals(due, scheduler.scheduled[id])
    }

    @Test
    fun rescheduleAllCancelsAlreadyNotifiedPeriodicReminder() = runTest {
        val id = insertPeriodic(
            due = now - HOUR_MILLIS,
            notifiedAt = now - HOUR_MILLIS,
        )

        actions.rescheduleAll()

        assertTrue(scheduler.cancels.contains(id))
        assertNull(scheduler.scheduled[id])
        assertTrue(notifier.shown.isEmpty())
    }

    @Test
    fun snoozeReschedulesTwentyFourHoursFromNowAndClearsNotification() = runTest {
        val id = insertReminder(due = now, notifiedAt = now)

        actions.onSnooze(id)

        val expected = now + 24L * HOUR_MILLIS
        assertEquals(expected, dao.getById(id)!!.reminderAt)
        assertNull(dao.getById(id)!!.reminderNotifiedAt)
        assertEquals(expected, scheduler.scheduled[id])
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun periodicSnoozeKeepsRecurrenceFields() = runTest {
        val id = insertPeriodic(
            due = now,
            unit = RecurrenceUnit.MONTHS,
            count = 2,
            mode = RecurrenceMode.RELATIVE,
            notifiedAt = now,
        )

        actions.onSnooze(id)

        val note = dao.getById(id)!!
        assertEquals(now + 24L * HOUR_MILLIS, note.reminderAt)
        assertEquals(RecurrenceUnit.MONTHS, note.recurrenceUnit)
        assertEquals(2, note.recurrenceCount)
        assertEquals(RecurrenceMode.RELATIVE, note.recurrenceMode)
        assertNull(note.reminderNotifiedAt)
    }

    @Test
    fun doneDeletesOneTimeNoteAndCancelsBothBoundaries() = runTest {
        val id = insertReminder(due = now, notifiedAt = now)

        actions.onDone(id)

        assertNull(dao.getById(id))
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun absoluteDoneKeepsPeriodicNoteAndAdvancesFromPreviousDue() = runTest {
        now = utc("2026-01-10T12:00:00Z")
        val due = utc("2026-01-01T09:00:00Z")
        val id = insertPeriodic(
            due = due,
            unit = RecurrenceUnit.DAYS,
            count = 2,
            mode = RecurrenceMode.ABSOLUTE,
            notifiedAt = now,
        )

        actions.onDone(id)

        val note = dao.getById(id)!!
        assertEquals(utc("2026-01-11T09:00:00Z"), note.reminderAt)
        assertNull(note.reminderNotifiedAt)
        assertEquals(RecurrenceUnit.DAYS, note.recurrenceUnit)
        assertEquals(2, note.recurrenceCount)
        assertEquals(RecurrenceMode.ABSOLUTE, note.recurrenceMode)
        assertEquals(utc("2026-01-11T09:00:00Z"), scheduler.scheduled[id])
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun relativeDoneKeepsPeriodicNoteAndCountsFromCompletion() = runTest {
        now = utc("2026-01-10T12:00:00Z")
        val id = insertPeriodic(
            due = utc("2026-01-01T09:00:00Z"),
            unit = RecurrenceUnit.WEEKS,
            count = 2,
            mode = RecurrenceMode.RELATIVE,
            notifiedAt = now,
        )

        actions.onDone(id)

        val note = dao.getById(id)!!
        assertEquals(utc("2026-01-24T12:00:00Z"), note.reminderAt)
        assertEquals(utc("2026-01-24T12:00:00Z"), scheduler.scheduled[id])
    }

    @Test
    fun absoluteDoneSkipsAllMissedOccurrences() = runTest {
        now = utc("2026-01-10T12:00:00Z")
        val id = insertPeriodic(
            due = utc("2026-01-01T09:00:00Z"),
            unit = RecurrenceUnit.DAYS,
            count = 2,
            mode = RecurrenceMode.ABSOLUTE,
            notifiedAt = now,
        )

        actions.onDone(id)

        assertEquals(utc("2026-01-11T09:00:00Z"), dao.getById(id)!!.reminderAt)
    }

    @Test
    fun clearReminderKeepsNoteAndCancelsBothBoundaries() = runTest {
        val id = insertPeriodic(due = now + HOUR_MILLIS)

        actions.clearReminder(id)

        val note = dao.getById(id)!!
        assertNull(note.reminderAt)
        assertNull(note.recurrenceUnit)
        assertNull(note.recurrenceCount)
        assertNull(note.recurrenceMode)
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun deletePeriodicNoteCancelsBothBoundaries() = runTest {
        val id = insertPeriodic(due = now + HOUR_MILLIS)

        actions.deleteNote(id)

        assertNull(dao.getById(id))
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }
}
