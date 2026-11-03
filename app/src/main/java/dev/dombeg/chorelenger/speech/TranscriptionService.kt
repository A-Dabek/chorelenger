package dev.dombeg.chorelenger.speech

import kotlinx.coroutines.flow.StateFlow

/**
 * The seam between the app and whatever turns speech into text.
 *
 * v1 ships [NativeTranscriptionService] (system [android.speech.SpeechRecognizer]).
 * A future backend (OpenRouter STT, on-device model) is a swap, not a rewrite.
 */
interface TranscriptionService {
    val state: StateFlow<VoiceState>

    fun isAvailable(): Boolean

    /** Begin listening. */
    fun start()

    /** Request end of the current utterance; a final result is still delivered. */
    fun stop()

    /** Abandon the current utterance without a result. */
    fun cancel()

    /** Clear a terminal [VoiceState.Result] or [VoiceState.Error] back to idle. */
    fun reset()

    /** Destroy the underlying recognizer. Call from lifecycle teardown. */
    fun release()
}
