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
}
