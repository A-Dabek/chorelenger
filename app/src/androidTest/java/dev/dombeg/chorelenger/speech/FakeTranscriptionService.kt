package dev.dombeg.chorelenger.speech

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Test double for the speech boundary. Everything else on device is real. */
class FakeTranscriptionService(
    private var available: Boolean = true,
) : TranscriptionService {

    private val _state = MutableStateFlow<VoiceState>(VoiceState.Idle)
    override val state: StateFlow<VoiceState> = _state

    var startCount = 0
        private set

    override fun isAvailable(): Boolean = available

    fun setAvailable(value: Boolean) {
        available = value
    }

    override fun start() {
        startCount++
        _state.value = VoiceState.Listening("")
    }

    override fun stop() = Unit

    override fun cancel() {
        _state.value = VoiceState.Idle
    }

    override fun reset() {
        _state.value = VoiceState.Idle
    }

    override fun release() = Unit

    fun emitPartial(text: String) {
        _state.value = VoiceState.Listening(text)
    }

    fun emitResult(text: String) {
        _state.value = VoiceState.Result(text)
    }

    fun emitError(kind: VoiceError) {
        _state.value = VoiceState.Error(kind, kind.defaultMessage())
    }
}
