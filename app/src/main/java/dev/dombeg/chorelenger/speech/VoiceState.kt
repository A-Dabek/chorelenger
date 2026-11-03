package dev.dombeg.chorelenger.speech

/**
 * The single source of truth for the recognizer's lifecycle. The UI is a pure
 * function of this state.
 */
sealed interface VoiceState {
    /** Nothing in progress. */
    data object Idle : VoiceState

    /** Actively listening; [partial] grows as partial results arrive. */
    data class Listening(val partial: String = "") : VoiceState

    /** A final transcript is available. The ViewModel consumes it. */
    data class Result(val text: String) : VoiceState

    /** Listening failed; [message] is user-facing. */
    data class Error(val kind: VoiceError, val message: String) : VoiceState
}
