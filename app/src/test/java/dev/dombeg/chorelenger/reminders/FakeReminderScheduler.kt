package dev.dombeg.chorelenger.reminders

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/** Test double for the alarm boundary. */
class FakeReminderScheduler : ReminderScheduler {
    val scheduled: MutableMap<Long, Long> = ConcurrentHashMap()
    val scheduleCalls = CopyOnWriteArrayList<Pair<Long, Long>>()
    val cancels = CopyOnWriteArrayList<Long>()

    override fun schedule(noteId: Long, triggerAt: Long) {
        scheduled[noteId] = triggerAt
        scheduleCalls += noteId to triggerAt
    }

    override fun cancel(noteId: Long) {
        cancels += noteId
        scheduled.remove(noteId)
    }
}
