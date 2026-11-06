package dev.dombeg.chorelenger.reminders

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dev.dombeg.chorelenger.R
import dev.dombeg.chorelenger.data.Note

/** Local high-importance reminder notification with Done / Snooze actions. */
class AndroidReminderNotifier(private val context: Context) : ReminderNotifier {

    override fun show(note: Note) {
        ensureChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification_alarm)
            .setContentTitle("Reminder")
            .setContentText(note.text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(note.text))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(ReminderIntents.content(context, note.id))
            .addAction(0, "Done", ReminderIntents.done(context, note.id))
            .addAction(0, "Snooze 24 h", ReminderIntents.snooze(context, note.id))
            .build()
        NotificationManagerCompat.from(context).notify(note.id.toInt(), notification)
    }

    override fun cancel(noteId: Long) {
        NotificationManagerCompat.from(context).cancel(noteId.toInt())
    }

    companion object {
        const val CHANNEL_ID = "reminders"
        const val CHANNEL_NAME = "Reminders"

        fun ensureChannel(context: Context) {
            val manager = context.getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            )
            manager.createNotificationChannel(channel)
        }
    }
}
