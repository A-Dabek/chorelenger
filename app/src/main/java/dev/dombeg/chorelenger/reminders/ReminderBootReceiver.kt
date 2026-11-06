package dev.dombeg.chorelenger.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import dev.dombeg.chorelenger.ChorelengerApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Re-arms every future reminder after reboot or app update. */
class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }
        val actions = (context.applicationContext as ChorelengerApp).container.reminderActions()
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                actions.rescheduleAll()
            } finally {
                pending.finish()
            }
        }
    }
}
