package dev.dombeg.chorelenger.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Instrumented mirror of the critical Room DAO integration test. */
@RunWith(AndroidJUnit4::class)
class NoteDaoInstrumentedTest {

    private lateinit var db: AppDatabase
    private lateinit var dao: NoteDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = db.noteDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun observesNewestFirstAndDeletes() = runTest {
        dao.insert(Note(text = "first", createdAt = 100L))
        val id = dao.insert(Note(text = "second", createdAt = 200L))

        assertEquals(listOf("second", "first"), dao.observeAll().first().map { it.text })

        dao.deleteById(id)
        assertEquals(listOf("first"), dao.observeAll().first().map { it.text })
    }

    @Test
    fun reminderColumnsRoundTripAndSortFirst() = runTest {
        dao.insert(Note(text = "ordinary", createdAt = 100L))
        val id = dao.insert(
            Note(text = "reminder", createdAt = 200L, reminderAt = 5_000L),
        )

        dao.markReminderNotified(id, 6_000L)

        val note = dao.getById(id)!!
        assertEquals(5_000L, note.reminderAt)
        assertEquals(6_000L, note.reminderNotifiedAt)
        assertEquals(listOf("reminder", "ordinary"), dao.observeAll().first().map { it.text })

        dao.clearReminder(id)
        assertEquals(null, dao.getById(id)!!.reminderAt)
        assertEquals(listOf("reminder", "ordinary"), dao.observeAll().first().map { it.text })
    }

    @Test
    fun recurrenceColumnsRoundTrip() = runTest {
        val id = dao.insert(Note(text = "repeat", createdAt = 100L))

        dao.setPeriodicReminder(id, 5_000L, RecurrenceUnit.MONTHS, 3, RecurrenceMode.RELATIVE)

        val note = dao.getById(id)!!
        assertEquals(5_000L, note.reminderAt)
        assertEquals(RecurrenceUnit.MONTHS, note.recurrenceUnit)
        assertEquals(3, note.recurrenceCount)
        assertEquals(RecurrenceMode.RELATIVE, note.recurrenceMode)
        assertEquals(listOf("repeat"), dao.observePeriodic().first().map { it.text })
        assertEquals(emptyList<Note>(), dao.observeActive().first())

        dao.setOneTimeReminder(id, 6_000L)

        val oneTime = dao.getById(id)!!
        assertEquals(null, oneTime.recurrenceUnit)
        assertEquals(null, oneTime.recurrenceCount)
        assertEquals(null, oneTime.recurrenceMode)
        assertEquals(listOf("repeat"), dao.observeActive().first().map { it.text })
    }
}
