package dev.dombeg.chorelenger.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import dev.dombeg.chorelenger.ChorelengerApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Thin receiver: hands the alarm to [ReminderActions.onAlarmFired]. */
class ReminderAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val noteId = ReminderIntents.noteId(intent) ?: return
        val actions = (context.applicationContext as ChorelengerApp).container.reminderActions()
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                actions.onAlarmFired(noteId)
            } finally {
                pending.finish()
            }
        }
    }
}
