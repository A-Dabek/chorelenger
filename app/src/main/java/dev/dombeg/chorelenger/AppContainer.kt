package dev.dombeg.chorelenger

import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.speech.TranscriptionService

/**
 * Hand-written service locator. No DI framework by design (ADR 4).
 *
 * Tests swap the whole container before the Activity launches.
 */
interface AppContainer {
    fun noteDao(): NoteDao
    fun transcriptionService(): TranscriptionService

    /**
     * Whether the mic permission is already held. Production reads the real
     * permission; tests report granted so the E2E path never needs the system
     * dialog (some devices forbid programmatic grants).
     */
    fun isAudioPermissionGranted(): Boolean
}
