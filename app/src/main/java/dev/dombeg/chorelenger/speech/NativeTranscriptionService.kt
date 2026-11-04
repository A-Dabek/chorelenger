package dev.dombeg.chorelenger.speech

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

/**
 * [TranscriptionService] backed by the system [SpeechRecognizer].
 *
 * The recognizer must be created and driven on the main thread, so every call
 * is marshalled through [mainHandler].
 */
class NativeTranscriptionService(
    context: Context,
    private val mainHandler: Handler = Handler(Looper.getMainLooper()),
) : TranscriptionService, RecognitionListener {

    private val appContext = context.applicationContext

    private val _state = MutableStateFlow<VoiceState>(VoiceState.Idle)
    override val state: StateFlow<VoiceState> = _state.asStateFlow()

    private var recognizer: SpeechRecognizer? = null

    override fun isAvailable(): Boolean = try {
        SpeechRecognizer.isRecognitionAvailable(appContext)
    } catch (_: Throwable) {
        false
    }

    override fun start() {
        if (!isAvailable()) {
            emitError(VoiceError.NotAvailable)
            return
        }
        if (!hasAudioPermission()) {
            emitError(VoiceError.PermissionDenied)
            return
        }
        mainHandler.post {
            val sr = recognizer ?: createRecognizer().also {
                it.setRecognitionListener(this)
                recognizer = it
            }
            _state.value = VoiceState.Listening("")
            sr.startListening(buildIntent())
        }
    }

    override fun stop() {
        mainHandler.post { recognizer?.stopListening() }
    }

    override fun cancel() {
        mainHandler.post {
            recognizer?.cancel()
            _state.value = VoiceState.Idle
        }
    }

    override fun reset() {
        _state.value = VoiceState.Idle
    }

    override fun release() {
        mainHandler.post {
            recognizer?.cancel()
            recognizer?.destroy()
            recognizer = null
            _state.value = VoiceState.Idle
        }
    }

    private fun createRecognizer(): SpeechRecognizer =
        // Use the system's default recognizer. `createOnDeviceSpeechRecognizer`
        // fails immediately when no on-device language model is installed.
        SpeechRecognizer.createSpeechRecognizer(appContext)

    private fun buildIntent(): Intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        // Language-only ("en"), not the full region tag ("en-PL"): many
        // recognizers reject region variants they have no model for.
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().language)
        // Forcing offline fails on devices without the offline language pack;
        // allow the recognizer to use the network when it needs to.
        putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false)
    }

    private fun hasAudioPermission(): Boolean =
        ContextCompat.checkSelfPermission(appContext, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    private fun emitError(kind: VoiceError) {
        _state.value = VoiceState.Error(kind, kind.defaultMessage())
    }

    // --- RecognitionListener ---

    override fun onReadyForSpeech(params: Bundle?) {
        _state.value = VoiceState.Listening("")
    }

    override fun onBeginningOfSpeech() {
        _state.value = VoiceState.Listening("")
    }

    override fun onRmsChanged(rmsdB: Float) = Unit

    override fun onBufferReceived(buffer: ByteArray?) = Unit

    override fun onEndOfSpeech() = Unit

    override fun onPartialResults(partialResults: Bundle?) {
        val text = bestResult(partialResults).orEmpty()
        _state.value = VoiceState.Listening(text)
    }

    override fun onResults(results: Bundle?) {
        val text = bestResult(results).orEmpty()
        _state.value = VoiceState.Result(text)
    }

    override fun onError(error: Int) {
        val kind = mapSpeechErrorCode(error)
        Log.w(TAG, "SpeechRecognizer error code=$error -> ${kind.name}")
        emitError(kind)
    }

    override fun onEvent(eventType: Int, params: Bundle?) = Unit

    private fun bestResult(bundle: Bundle?): String? =
        bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()

    private companion object {
        const val TAG = "ChorelengerSpeech"
    }
}
