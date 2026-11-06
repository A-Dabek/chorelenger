package dev.dombeg.chorelenger.reminders

import dev.dombeg.chorelenger.data.Note
import java.util.concurrent.CopyOnWriteArrayList

/** Test double for the notification boundary. */
class FakeReminderNotifier : ReminderNotifier {
    val shown = CopyOnWriteArrayList<Note>()
    val cancels = CopyOnWriteArrayList<Long>()

    override fun show(note: Note) {
        shown += note
    }

    override fun cancel(noteId: Long) {
        cancels += noteId
    }
}
