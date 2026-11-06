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

/** Opens a raw v1 database and proves the real MIGRATION_1_2 preserves notes. */
@RunWith(AndroidJUnit4::class)
class AppDatabaseMigrationTest {

    @Test
    fun migration1To2KeepsNotesAndAddsNullableReminderColumns() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val dbName = "migration-1-2-test.db"
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
            .addMigrations(AppDatabase.MIGRATION_1_2)
            .allowMainThreadQueries()
            .build()
        try {
            val note = db.noteDao().observeAll().first().single()
            assertEquals("legacy note", note.text)
            assertEquals(123L, note.createdAt)
            assertNull(note.reminderAt)
            assertNull(note.reminderNotifiedAt)
        } finally {
            db.close()
            dbFile.delete()
        }
    }
}
