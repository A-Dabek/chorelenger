package dev.dombeg.chorelenger.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/** Opens raw legacy databases and proves the hand-written migrations preserve notes. */
@RunWith(AndroidJUnit4::class)
class AppDatabaseMigrationTest {

    @Test
    fun migration1To3KeepsNotesAndAddsNullableColumns() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val dbName = "migration-1-3-test.db"
        val dbFile = context.getDatabasePath(dbName)
        dbFile.parentFile?.mkdirs()
        dbFile.delete()

        val raw = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
        raw.execSQL(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                text TEXT NOT NULL,
                createdAt INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        raw.execSQL("INSERT INTO notes (text, createdAt) VALUES ('legacy note', 123)")
        raw.version = 1
        raw.close()

        val db = Room.databaseBuilder(context, AppDatabase::class.java, dbName)
            .addMigrations(AppDatabase.MIGRATION_1_2, AppDatabase.MIGRATION_2_3)
            .allowMainThreadQueries()
            .build()
        try {
            val note = db.noteDao().observeAll().first().single()
            assertEquals("legacy note", note.text)
            assertEquals(123L, note.createdAt)
            assertNull(note.reminderAt)
            assertNull(note.reminderNotifiedAt)
            assertNull(note.recurrenceUnit)
            assertNull(note.recurrenceCount)
            assertNull(note.recurrenceMode)
        } finally {
            db.close()
            dbFile.delete()
        }
    }

    @Test
    fun migration2To3PreservesOneTimeReminderAndNullsRecurrence() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val dbName = "migration-2-3-test.db"
        val dbFile = context.getDatabasePath(dbName)
        dbFile.parentFile?.mkdirs()
        dbFile.delete()

        val raw = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
        raw.execSQL(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                text TEXT NOT NULL,
                createdAt INTEGER NOT NULL,
                reminderAt INTEGER,
                reminderNotifiedAt INTEGER
            )
            """.trimIndent(),
        )
        raw.execSQL(
            "INSERT INTO notes (text, createdAt, reminderAt) VALUES ('legacy reminder', 456, 789)",
        )
        raw.version = 2
        raw.close()

        val db = Room.databaseBuilder(context, AppDatabase::class.java, dbName)
            .addMigrations(AppDatabase.MIGRATION_1_2, AppDatabase.MIGRATION_2_3)
            .allowMainThreadQueries()
            .build()
        try {
            val note = db.noteDao().observeAll().first().single()
            assertEquals("legacy reminder", note.text)
            assertEquals(789L, note.reminderAt)
            assertNull(note.reminderNotifiedAt)
            assertNull(note.recurrenceUnit)
            assertNull(note.recurrenceCount)
            assertNull(note.recurrenceMode)
        } finally {
            db.close()
            dbFile.delete()
        }
    }
}
