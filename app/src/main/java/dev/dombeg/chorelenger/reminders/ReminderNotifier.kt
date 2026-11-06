package dev.dombeg.chorelenger.reminders

import dev.dombeg.chorelenger.data.Note

/** Android notification boundary; the production implementation uses NotificationManagerCompat. */
interface ReminderNotifier {
    fun show(note: Note)
    fun cancel(noteId: Long)
}
