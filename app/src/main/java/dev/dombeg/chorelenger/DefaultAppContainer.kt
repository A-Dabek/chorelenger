package dev.dombeg.chorelenger

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.reminders.AlarmReminderScheduler
import dev.dombeg.chorelenger.reminders.AndroidReminderNotifier
import dev.dombeg.chorelenger.reminders.ReminderActions
import dev.dombeg.chorelenger.speech.NativeTranscriptionService
import dev.dombeg.chorelenger.speech.TranscriptionService

/** Production container: real Room database + system speech recognizer + alarms. */
class DefaultAppContainer(private val context: Context) : AppContainer {

    private val database by lazy { AppDatabase.get(context) }
    private val transcription by lazy { NativeTranscriptionService(context) }
    private val reminderActions by lazy {
        ReminderActions(
            noteDao = database.noteDao(),
            scheduler = AlarmReminderScheduler(context.applicationContext),
            notifier = AndroidReminderNotifier(context.applicationContext),
        )
    }

    override fun noteDao(): NoteDao = database.noteDao()

    override fun transcriptionService(): TranscriptionService = transcription

    override fun reminderActions(): ReminderActions = reminderActions

    override fun isAudioPermissionGranted(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    override fun isNotificationPermissionGranted(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
}
