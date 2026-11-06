package dev.dombeg.chorelenger.reminders

/** Android alarm boundary; the production implementation uses AlarmManager. */
interface ReminderScheduler {
    fun schedule(noteId: Long, triggerAt: Long)
    fun cancel(noteId: Long)
}
