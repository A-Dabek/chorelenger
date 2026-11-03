package dev.dombeg.chorelenger.speech

import android.speech.SpeechRecognizer

/**
 * Normalized, UI-friendly classification of recognizer failures.
 */
enum class VoiceError {
    NotAvailable,
    PermissionDenied,
    NoMatch,
    SpeechTimeout,
    Busy,
    Network,
    Audio,
    Client,
    Unknown,
}

/**
 * Pure mapping from a [SpeechRecognizer] error code to a [VoiceError].
 * Kept framework-pure so it can be unit-tested without the speech stack.
 * The `ERROR_*` values are compile-time constants, so this needs no runtime
 * Android classes under a JVM test.
 */
fun mapSpeechErrorCode(code: Int): VoiceError = when (code) {
    SpeechRecognizer.ERROR_NO_MATCH -> VoiceError.NoMatch
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> VoiceError.SpeechTimeout
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> VoiceError.Busy
    SpeechRecognizer.ERROR_NETWORK,
    SpeechRecognizer.ERROR_NETWORK_TIMEOUT,
    -> VoiceError.Network
    SpeechRecognizer.ERROR_AUDIO -> VoiceError.Audio
    SpeechRecognizer.ERROR_CLIENT -> VoiceError.Client
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> VoiceError.PermissionDenied
    else -> VoiceError.Unknown
}

/** Short, user-facing text for each failure kind. */
fun VoiceError.defaultMessage(): String = when (this) {
    VoiceError.NotAvailable -> "Speech recognition isn't available on this device"
    VoiceError.PermissionDenied -> "Microphone permission is required"
    VoiceError.NoMatch -> "Didn't catch that - try again"
    VoiceError.SpeechTimeout -> "Heard nothing - try again"
    VoiceError.Busy -> "Recognizer is busy - try again"
    VoiceError.Network -> "Network error during recognition"
    VoiceError.Audio -> "Audio error - try again"
    VoiceError.Client -> "Recognition was interrupted"
    VoiceError.Unknown -> "Something went wrong"
}
