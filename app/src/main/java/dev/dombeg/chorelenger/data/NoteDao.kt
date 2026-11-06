package dev.dombeg.chorelenger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {
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

    @Query("UPDATE notes SET reminderAt = :triggerAt, reminderNotifiedAt = NULL WHERE id = :id")
    suspend fun setReminder(id: Long, triggerAt: Long)

    @Query("UPDATE notes SET reminderAt = NULL, reminderNotifiedAt = NULL WHERE id = :id")
    suspend fun clearReminder(id: Long)

    @Query("UPDATE notes SET reminderNotifiedAt = :notifiedAt WHERE id = :id")
    suspend fun markReminderNotified(id: Long, notifiedAt: Long)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteById(id: Long)
}
