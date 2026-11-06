package dev.dombeg.chorelenger.reminders

import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import dev.dombeg.chorelenger.data.isPeriodic
import java.time.ZoneId

/**
 * Reminder use-cases. Pure coroutine orchestration over the DAO and the two
 * Android seams; no UI types.
 */
class ReminderActions(
    private val noteDao: NoteDao,
    private val scheduler: ReminderScheduler,
    private val notifier: ReminderNotifier,
    private val now: () -> Long = System::currentTimeMillis,
    private val zone: ZoneId = ZoneId.systemDefault(),
) {

    suspend fun setOneTimeReminder(noteId: Long, triggerAt: Long) {
        noteDao.setOneTimeReminder(noteId, triggerAt)
        notifier.cancel(noteId)
        scheduler.schedule(noteId, triggerAt)
    }

    suspend fun setPeriodicReminder(
        noteId: Long,
        firstAt: Long,
        unit: RecurrenceUnit,
        count: Int,
        mode: RecurrenceMode,
    ) {
        noteDao.setPeriodicReminder(noteId, firstAt, unit, count, mode)
        notifier.cancel(noteId)
        scheduler.schedule(noteId, firstAt)
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
        val note = noteDao.getById(noteId) ?: return
        val spec = note.recurrenceSpec
        if (!note.isPeriodic || spec == null) {
            deleteNote(noteId)
            return
        }
        val previousDue = note.reminderAt ?: return
        val next = nextOccurrence(spec, previousDue, now(), zone)
        noteDao.advanceReminder(noteId, next)
        scheduler.schedule(noteId, next)
        notifier.cancel(noteId)
    }

    suspend fun onSnooze(noteId: Long) {
        val note = noteDao.getById(noteId) ?: return
        val next = now() + SNOOZE_HOURS * HOUR_MILLIS
        // Recurrence fields stay untouched; the snoozed due time becomes the
        // new previous due for absolute counting.
        noteDao.advanceReminder(noteId, next)
        scheduler.schedule(noteId, next)
        notifier.cancel(noteId)
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
