package dev.dombeg.chorelenger

import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.reminders.ReminderActions
import dev.dombeg.chorelenger.speech.TranscriptionService

/**
 * Hand-written service locator. No DI framework by design (ADR 4).
 *
 * Tests swap the whole container before the Activity launches.
 */
interface AppContainer {
    fun noteDao(): NoteDao
    fun transcriptionService(): TranscriptionService
    fun reminderActions(): ReminderActions

    /**
     * Whether the mic permission is already held. Production reads the real
     * permission; tests report granted so the E2E path never needs the system
     * dialog (some devices forbid programmatic grants).
     */
    fun isAudioPermissionGranted(): Boolean

    /** Whether reminder notifications may be posted; tests report granted. */
    fun isNotificationPermissionGranted(): Boolean
}
