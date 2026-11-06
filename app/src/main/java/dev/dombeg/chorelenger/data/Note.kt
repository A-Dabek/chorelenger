package dev.dombeg.chorelenger.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A single spoken note. Short-lived by design; deleted when done, unless it
 * carries a periodic recurrence, in which case Done advances it instead.
 */
@Entity(tableName = "notes")
data class Note(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,
    val createdAt: Long = System.currentTimeMillis(),
    /** Next/previous due time for a reminder; null for an ordinary note. */
    val reminderAt: Long? = null,
    /** When the reminder notification was posted; null while still pending. */
    val reminderNotifiedAt: Long? = null,
    /** Calendar unit for a repeating reminder; null for one-time/ordinary. */
    val recurrenceUnit: RecurrenceUnit? = null,
    /** Interval size in [recurrenceUnit]s. */
    val recurrenceCount: Int? = null,
    /** Absolute (previous due) vs relative (Done tap) counting. */
    val recurrenceMode: RecurrenceMode? = null,
)

val Note.isReminder: Boolean get() = reminderAt != null

val Note.isPeriodic: Boolean
    get() = recurrenceUnit != null && recurrenceCount != null && recurrenceMode != null

val Note.isOneTime: Boolean get() = isReminder && !isPeriodic
