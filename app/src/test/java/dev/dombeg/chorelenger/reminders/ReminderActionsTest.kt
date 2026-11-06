package dev.dombeg.chorelenger.reminders

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.NoteDao
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

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).allowMainThreadQueries().build()
        dao = db.noteDao()
        scheduler = FakeReminderScheduler()
        notifier = FakeReminderNotifier()
        actions = ReminderActions(dao, scheduler, notifier, now = { now })
    }

    @After
    fun tearDown() {
        db.close()
    }

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

    @Test
    fun setReminderPersistsAndSchedules() = runTest {
        val id = dao.insert(Note(text = "walk", createdAt = 1L))

        actions.setReminder(id, 5_000L)

        assertEquals(5_000L, dao.getById(id)!!.reminderAt)
        assertEquals(5_000L, scheduler.scheduled[id])
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
    fun rescheduleAllCancelsAlreadyNotifiedReminder() = runTest {
        val id = insertReminder(due = now - HOUR_MILLIS, notifiedAt = now - HOUR_MILLIS)

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
    fun doneDeletesNoteAndCancelsBothBoundaries() = runTest {
        val id = insertReminder(due = now, notifiedAt = now)

        actions.onDone(id)

        assertNull(dao.getById(id))
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun clearReminderKeepsNoteAndCancelsBothBoundaries() = runTest {
        val id = insertReminder(due = now + HOUR_MILLIS)

        actions.clearReminder(id)

        val note = dao.getById(id)!!
        assertNull(note.reminderAt)
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun deleteNoteCancelsBothBoundaries() = runTest {
        val id = insertReminder(due = now + HOUR_MILLIS)

        actions.deleteNote(id)

        assertNull(dao.getById(id))
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }
}
