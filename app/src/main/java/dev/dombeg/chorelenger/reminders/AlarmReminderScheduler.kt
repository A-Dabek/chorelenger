package dev.dombeg.chorelenger.reminders

import android.app.AlarmManager
import android.content.Context

/** Inexact, Doze-friendly alarm scheduling; no exact-alarm permission needed. */
class AlarmReminderScheduler(private val context: Context) : ReminderScheduler {

    private val alarmManager: AlarmManager =
        context.getSystemService(AlarmManager::class.java)

    override fun schedule(noteId: Long, triggerAt: Long) {
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAt,
            ReminderIntents.alarm(context, noteId),
        )
    }

    override fun cancel(noteId: Long) {
        alarmManager.cancel(ReminderIntents.alarm(context, noteId))
    }
}
