package dev.dombeg.chorelenger.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/** Integration test: real Room over an in-memory SQLite database. */
@RunWith(AndroidJUnit4::class)
class NoteDaoTest {

    private lateinit var db: AppDatabase
    private lateinit var dao: NoteDao

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).allowMainThreadQueries().build()
        dao = db.noteDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun insertThenObserveReturnsNote() = runTest {
        dao.insert(Note(text = "walk the dog", createdAt = 100L))

        val notes = dao.observeAll().first()

        assertEquals(1, notes.size)
        assertEquals("walk the dog", notes.first().text)
    }

    @Test
    fun observesNewestFirst() = runTest {
        dao.insert(Note(text = "first", createdAt = 100L))
        dao.insert(Note(text = "second", createdAt = 200L))

        val notes = dao.observeAll().first()

        assertEquals(listOf("second", "first"), notes.map { it.text })
    }

    @Test
    fun sameTimestampFallsBackToInsertionOrderNewestFirst() = runTest {
        val firstId = dao.insert(Note(text = "first", createdAt = 100L))
        val secondId = dao.insert(Note(text = "second", createdAt = 100L))

        val notes = dao.observeAll().first()

        assertEquals(secondId, notes[0].id)
        assertEquals(firstId, notes[1].id)
    }

    @Test
    fun deleteByIdRemovesNote() = runTest {
        val id = dao.insert(Note(text = "temp", createdAt = 100L))

        dao.deleteById(id)

        assertEquals(emptyList<Note>(), dao.observeAll().first())
    }

    @Test
    fun getByIdReturnsNoteOrNull() = runTest {
        val id = dao.insert(Note(text = "walk", createdAt = 100L))

        assertEquals("walk", dao.getById(id)?.text)
        assertNull(dao.getById(id + 1))
    }

    @Test
    fun setReminderSetsDueAndClearsNotified() = runTest {
        val id = dao.insert(
            Note(text = "walk", createdAt = 100L, reminderNotifiedAt = 50L),
        )

        dao.setReminder(id, 900L)

        val note = dao.getById(id)!!
        assertEquals(900L, note.reminderAt)
        assertNull(note.reminderNotifiedAt)
    }

    @Test
    fun markAndClearReminder() = runTest {
        val id = dao.insert(Note(text = "walk", createdAt = 100L, reminderAt = 900L))

        dao.markReminderNotified(id, 1_000L)
        assertEquals(1_000L, dao.getById(id)!!.reminderNotifiedAt)

        dao.clearReminder(id)
        val note = dao.getById(id)!!
        assertNull(note.reminderAt)
        assertNull(note.reminderNotifiedAt)
    }

    @Test
    fun allRemindersReturnsOnlyReminderNotes() = runTest {
        dao.insert(Note(text = "ordinary", createdAt = 100L))
        dao.insert(Note(text = "due later", createdAt = 200L, reminderAt = 900L))
        dao.insert(Note(text = "due sooner", createdAt = 300L, reminderAt = 500L))

        assertEquals(
            listOf("due sooner", "due later"),
            dao.allReminders().map { it.text },
        )
    }

    @Test
    fun remindersSortFirstByDueThenOrdinaryNewestFirst() = runTest {
        dao.insert(Note(text = "old note", createdAt = 100L))
        dao.insert(Note(text = "new note", createdAt = 200L))
        dao.insert(Note(text = "later reminder", createdAt = 300L, reminderAt = 900L))
        dao.insert(Note(text = "sooner reminder", createdAt = 400L, reminderAt = 500L))

        val notes = dao.observeAll().first()

        assertEquals(
            listOf("sooner reminder", "later reminder", "new note", "old note"),
            notes.map { it.text },
        )
        assertNotNull(notes.first().reminderAt)
    }
}
