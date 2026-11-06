package dev.dombeg.chorelenger.reminders

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import dev.dombeg.chorelenger.MainActivity

/**
 * Intent actions, extras and request codes for reminders.
 *
 * PendingIntent equality ignores extras, so every purpose gets its own request
 * code: `noteId * 4 + slot`.
 */
object ReminderIntents {
    const val ACTION_REMINDER_ALARM = "dev.dombeg.chorelenger.action.REMINDER_ALARM"
    const val ACTION_REMINDER_DONE = "dev.dombeg.chorelenger.action.REMINDER_DONE"
    const val ACTION_REMINDER_SNOOZE = "dev.dombeg.chorelenger.action.REMINDER_SNOOZE"
    const val EXTRA_NOTE_ID = "dev.dombeg.chorelenger.extra.NOTE_ID"

    private const val SLOT_ALARM = 0
    private const val SLOT_DONE = 1
    private const val SLOT_SNOOZE = 2
    private const val SLOT_CONTENT = 3

    private const val FLAGS = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

    fun alarm(context: Context, noteId: Long): PendingIntent = PendingIntent.getBroadcast(
        context,
        requestCode(noteId, SLOT_ALARM),
        Intent(context, ReminderAlarmReceiver::class.java)
            .setAction(ACTION_REMINDER_ALARM)
            .putExtra(EXTRA_NOTE_ID, noteId),
        FLAGS,
    )

    fun done(context: Context, noteId: Long): PendingIntent = action(
        context,
        noteId,
        ACTION_REMINDER_DONE,
        SLOT_DONE,
    )

    fun snooze(context: Context, noteId: Long): PendingIntent = action(
        context,
        noteId,
        ACTION_REMINDER_SNOOZE,
        SLOT_SNOOZE,
    )

    fun content(context: Context, noteId: Long): PendingIntent = PendingIntent.getActivity(
        context,
        requestCode(noteId, SLOT_CONTENT),
        Intent(context, MainActivity::class.java)
            .putExtra(EXTRA_NOTE_ID, noteId),
        FLAGS,
    )

    fun noteId(intent: Intent): Long? =
        intent.getLongExtra(EXTRA_NOTE_ID, -1L).takeIf { it >= 0 }

    private fun action(
        context: Context,
        noteId: Long,
        action: String,
        slot: Int,
    ): PendingIntent = PendingIntent.getBroadcast(
        context,
        requestCode(noteId, slot),
        Intent(context, ReminderActionReceiver::class.java)
            .setAction(action)
            .putExtra(EXTRA_NOTE_ID, noteId),
        FLAGS,
    )

    private fun requestCode(noteId: Long, slot: Int): Int = (noteId * 4 + slot).toInt()
}
