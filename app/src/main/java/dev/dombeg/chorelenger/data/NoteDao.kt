package dev.dombeg.chorelenger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {
    /** Notes tab: ordinary notes plus one-time reminders, reminder-first. */
    @Query(
        """
        SELECT * FROM notes
        WHERE recurrenceUnit IS NULL
        ORDER BY CASE WHEN reminderAt IS NULL THEN 1 ELSE 0 END,
                 reminderAt ASC,
                 createdAt DESC,
                 id DESC
        """,
    )
    fun observeActive(): Flow<List<Note>>

    /** Repeats tab: periodic items only, ordered by next due. */
    @Query(
        """
        SELECT * FROM notes
        WHERE recurrenceUnit IS NOT NULL
        ORDER BY reminderAt ASC, id ASC
        """,
    )
    fun observePeriodic(): Flow<List<Note>>

    /** Every note; used by tests and migration checks. */
    @Query(
        """
        SELECT * FROM notes
        ORDER BY CASE WHEN reminderAt IS NULL THEN 1 ELSE 0 END,
                 reminderAt ASC,
                 createdAt DESC,
                 id DESC
        """,
    )
    fun observeAll(): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE id = :id")
    suspend fun getById(id: Long): Note?

    @Query("SELECT * FROM notes WHERE reminderAt IS NOT NULL ORDER BY reminderAt ASC, id ASC")
    suspend fun allReminders(): List<Note>

    @Insert
    suspend fun insert(note: Note): Long

    @Query(
        """
        UPDATE notes
        SET reminderAt = :triggerAt,
            reminderNotifiedAt = NULL,
            recurrenceUnit = NULL,
            recurrenceCount = NULL,
            recurrenceMode = NULL
        WHERE id = :id
        """,
    )
    suspend fun setOneTimeReminder(id: Long, triggerAt: Long)

    @Query(
        """
        UPDATE notes
        SET reminderAt = :firstAt,
            reminderNotifiedAt = NULL,
            recurrenceUnit = :unit,
            recurrenceCount = :count,
            recurrenceMode = :mode
        WHERE id = :id
        """,
    )
    suspend fun setPeriodicReminder(
        id: Long,
        firstAt: Long,
        unit: RecurrenceUnit,
        count: Int,
        mode: RecurrenceMode,
    )

    /** Moves a periodic occurrence forward without touching its recurrence. */
    @Query("UPDATE notes SET reminderAt = :nextAt, reminderNotifiedAt = NULL WHERE id = :id")
    suspend fun advanceReminder(id: Long, nextAt: Long)

    @Query(
        """
        UPDATE notes
        SET reminderAt = NULL,
            reminderNotifiedAt = NULL,
            recurrenceUnit = NULL,
            recurrenceCount = NULL,
            recurrenceMode = NULL
        WHERE id = :id
        """,
    )
    suspend fun clearReminder(id: Long)

    @Query("UPDATE notes SET reminderNotifiedAt = :notifiedAt WHERE id = :id")
    suspend fun markReminderNotified(id: Long, notifiedAt: Long)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteById(id: Long)
}
