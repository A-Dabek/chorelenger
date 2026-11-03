package dev.dombeg.chorelenger.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY createdAt DESC, id DESC")
    fun observeAll(): Flow<List<Note>>

    @Insert
    suspend fun insert(note: Note): Long

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteById(id: Long)
}
