package dev.dombeg.chorelenger.data

import androidx.room.TypeConverter

/** Calendar unit for a repeating reminder. */
enum class RecurrenceUnit { DAYS, WEEKS, MONTHS }

/**
 * How the next occurrence is counted.
 *
 * ABSOLUTE chains from the previous due time; RELATIVE counts from the Done tap.
 */
enum class RecurrenceMode { ABSOLUTE, RELATIVE }

/** Room converters: enum names are stored as `TEXT` so the schema stays readable. */
class RecurrenceConverters {
    @TypeConverter
    fun unitToString(value: RecurrenceUnit?): String? = value?.name

    @TypeConverter
    fun stringToUnit(value: String?): RecurrenceUnit? =
        value?.let { runCatching { RecurrenceUnit.valueOf(it) }.getOrNull() }

    @TypeConverter
    fun modeToString(value: RecurrenceMode?): String? = value?.name

    @TypeConverter
    fun stringToMode(value: String?): RecurrenceMode? =
        value?.let { runCatching { RecurrenceMode.valueOf(it) }.getOrNull() }
}
