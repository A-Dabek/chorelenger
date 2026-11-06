package dev.dombeg.chorelenger.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A single spoken note. Short-lived by design; deleted when done.
 */
@Entity(tableName = "notes")
data class Note(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,
    val createdAt: Long = System.currentTimeMillis(),
    /** Due time for a one-time reminder; null for an ordinary note. */
    val reminderAt: Long? = null,
    /** When the reminder notification was posted; null while still pending. */
    val reminderNotifiedAt: Long? = null,
)

val Note.isReminder: Boolean get() = reminderAt != null
