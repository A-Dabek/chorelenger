package dev.dombeg.chorelenger.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.speech.TranscriptionService
import dev.dombeg.chorelenger.speech.VoiceState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Plain constructor injection, no framework. The only collaborator that is not
 * a testable Android component is [transcription], which is the speech boundary.
 */
class NotesViewModel(
    private val noteDao: NoteDao,
    private val transcription: TranscriptionService,
) : ViewModel() {

    val notes: StateFlow<List<Note>> = noteDao.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** True when the device has a usable recognizer; captured once. */
    val isRecognizerAvailable: Boolean = transcription.isAvailable()

    private val _voiceState = MutableStateFlow<VoiceState>(VoiceState.Idle)
    val voiceState: StateFlow<VoiceState> = _voiceState.asStateFlow()

    init {
        viewModelScope.launch {
            transcription.state.collect { state ->
                when (state) {
                    is VoiceState.Result -> {
                        // Consume synchronously, before any suspension. Clearing the
                        // boundary first makes a later identical transcript a distinct
                        // emission instead of being conflated with the last value.
                        transcription.reset()
                        _voiceState.value = VoiceState.Idle
                        val note = sanitizeNoteText(state.text)?.let { Note(text = it) }
                        if (note != null) {
                            // Insert off the collector so it never blocks on the DB and
                            // can always observe the next result.
                            viewModelScope.launch { noteDao.insert(note) }
                        }
                    }
                    else -> _voiceState.value = state
                }
            }
        }
    }

    fun onRecordButtonTap() {
        when (_voiceState.value) {
            is VoiceState.Listening -> transcription.stop()
            else -> transcription.start()
        }
    }

    fun delete(id: Long) {
        viewModelScope.launch { noteDao.deleteById(id) }
    }

    override fun onCleared() {
        super.onCleared()
        transcription.release()
    }
}

/** Trim and reject blank transcripts. Pure; unit-tested. */
fun sanitizeNoteText(raw: String): String? = raw.trim().ifEmpty { null }
