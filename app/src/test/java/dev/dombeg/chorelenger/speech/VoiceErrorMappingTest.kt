package dev.dombeg.chorelenger.speech

import android.speech.SpeechRecognizer
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Pure unit test. The ERROR_* values are compile-time constants, so this runs
 * without the Android speech stack.
 */
class VoiceErrorMappingTest {

    @Test
    fun mapsNoMatch() {
        assertEquals(VoiceError.NoMatch, mapSpeechErrorCode(SpeechRecognizer.ERROR_NO_MATCH))
    }

    @Test
    fun mapsSpeechTimeout() {
        assertEquals(VoiceError.SpeechTimeout, mapSpeechErrorCode(SpeechRecognizer.ERROR_SPEECH_TIMEOUT))
    }

    @Test
    fun mapsBusy() {
        assertEquals(VoiceError.Busy, mapSpeechErrorCode(SpeechRecognizer.ERROR_RECOGNIZER_BUSY))
    }

    @Test
    fun mapsNetworkAndTimeoutToNetwork() {
        assertEquals(VoiceError.Network, mapSpeechErrorCode(SpeechRecognizer.ERROR_NETWORK))
        assertEquals(VoiceError.Network, mapSpeechErrorCode(SpeechRecognizer.ERROR_NETWORK_TIMEOUT))
    }

    @Test
    fun mapsAudio() {
        assertEquals(VoiceError.Audio, mapSpeechErrorCode(SpeechRecognizer.ERROR_AUDIO))
    }

    @Test
    fun mapsClient() {
        assertEquals(VoiceError.Client, mapSpeechErrorCode(SpeechRecognizer.ERROR_CLIENT))
    }

    @Test
    fun mapsInsufficientPermissions() {
        assertEquals(
            VoiceError.PermissionDenied,
            mapSpeechErrorCode(SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS),
        )
    }

    @Test
    fun unknownForUnmappedCode() {
        assertEquals(VoiceError.Unknown, mapSpeechErrorCode(9999))
    }

    @Test
    fun everyKindHasAMessage() {
        VoiceError.entries.forEach { kind ->
            assertEquals(true, kind.defaultMessage().isNotBlank())
        }
    }
}
