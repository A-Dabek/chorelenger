package dev.dombeg.chorelenger.reminders

import dev.dombeg.chorelenger.data.NoteDao

/**
 * Reminder use-cases. Pure coroutine orchestration over the DAO and the two
 * Android seams; no UI types.
 */
class ReminderActions(
    private val noteDao: NoteDao,
    private val scheduler: ReminderScheduler,
    private val notifier: ReminderNotifier,
    private val now: () -> Long = System::currentTimeMillis,
) {

    suspend fun setReminder(noteId: Long, triggerAt: Long) {
        noteDao.setReminder(noteId, triggerAt)
        scheduler.schedule(noteId, triggerAt)
    }

    suspend fun clearReminder(noteId: Long) {
        noteDao.clearReminder(noteId)
        scheduler.cancel(noteId)
        notifier.cancel(noteId)
    }

    suspend fun deleteNote(noteId: Long) {
        noteDao.deleteById(noteId)
        scheduler.cancel(noteId)
        notifier.cancel(noteId)
    }

    suspend fun onAlarmFired(noteId: Long) {
        val note = noteDao.getById(noteId) ?: return
        val reminderAt = note.reminderAt ?: return
        if (note.reminderNotifiedAt != null) return

        val current = now()
        if (reminderAt > current + STALE_ALARM_SLACK_MILLIS) {
            // The alarm belongs to an older due time; reschedule the current one.
            scheduler.schedule(noteId, reminderAt)
            return
        }

        notifier.show(note)
        noteDao.markReminderNotified(noteId, current)
    }

    suspend fun onDone(noteId: Long) {
        deleteNote(noteId)
    }

    suspend fun onSnooze(noteId: Long) {
        val note = noteDao.getById(noteId) ?: return
        val triggerAt = now() + SNOOZE_HOURS * HOUR_MILLIS
        noteDao.setReminder(note.id, triggerAt)
        scheduler.schedule(note.id, triggerAt)
        notifier.cancel(note.id)
    }

    suspend fun rescheduleAll() {
        val current = now()
        noteDao.allReminders().forEach { note ->
            val reminderAt = note.reminderAt ?: return@forEach
            if (note.reminderNotifiedAt != null) {
                scheduler.cancel(note.id)
            } else {
                scheduler.schedule(note.id, maxOf(reminderAt, current + 1_000L))
            }
        }
    }

    private companion object {
        const val STALE_ALARM_SLACK_MILLIS = 5_000L
    }
}
