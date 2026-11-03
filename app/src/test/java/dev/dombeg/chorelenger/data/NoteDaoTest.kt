package dev.dombeg.chorelenger.data

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
}
