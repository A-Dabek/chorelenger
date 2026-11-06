package dev.dombeg.chorelenger.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import dev.dombeg.chorelenger.ChorelengerApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Thin receiver for the notification's Done and Snooze actions. */
class ReminderActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val noteId = ReminderIntents.noteId(intent) ?: return
        val actions = (context.applicationContext as ChorelengerApp).container.reminderActions()
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                when (intent.action) {
                    ReminderIntents.ACTION_REMINDER_DONE -> actions.onDone(noteId)
                    ReminderIntents.ACTION_REMINDER_SNOOZE -> actions.onSnooze(noteId)
                }
            } finally {
                pending.finish()
            }
        }
    }
}
