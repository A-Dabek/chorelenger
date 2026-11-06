package dev.dombeg.chorelenger.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.reminders.DEFAULT_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.ReminderActions
import dev.dombeg.chorelenger.reminders.isValidReminderHours
import dev.dombeg.chorelenger.reminders.remainingReminderHours
import dev.dombeg.chorelenger.reminders.reminderTriggerAt
import dev.dombeg.chorelenger.speech.TranscriptionService
import dev.dombeg.chorelenger.speech.VoiceState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Everything the reminder editor needs, independent of the Room entity. */
data class ReminderDraft(
    val noteId: Long,
    val text: String,
    val initialHours: Int,
    val hasReminder: Boolean,
)

/**
 * Plain constructor injection, no framework. The Android collaborators are
 * isolated behind [transcription] and [reminderActions].
 */
class NotesViewModel(
    private val noteDao: NoteDao,
    private val transcription: TranscriptionService,
    private val reminderActions: ReminderActions,
    private val now: () -> Long = System::currentTimeMillis,
) : ViewModel() {

    val notes: StateFlow<List<Note>> = noteDao.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** True when the device has a usable recognizer; captured once. */
    val isRecognizerAvailable: Boolean = transcription.isAvailable()

    private val _voiceState = MutableStateFlow<VoiceState>(VoiceState.Idle)
    val voiceState: StateFlow<VoiceState> = _voiceState.asStateFlow()

    private val _reminderDraft = MutableStateFlow<ReminderDraft?>(null)
    val reminderDraft: StateFlow<ReminderDraft?> = _reminderDraft.asStateFlow()

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
        viewModelScope.launch { reminderActions.deleteNote(id) }
    }

    fun onEditReminder(note: Note) {
        val initialHours = note.reminderAt
            ?.let { remainingReminderHours(it, now()) }
            ?: DEFAULT_REMINDER_HOURS
        _reminderDraft.value = ReminderDraft(
            noteId = note.id,
            text = note.text,
            initialHours = initialHours,
            hasReminder = note.reminderAt != null,
        )
    }

    fun onDismissReminderEditor() {
        _reminderDraft.value = null
    }

    fun onConfirmReminder(hours: Int) {
        val draft = _reminderDraft.value ?: return
        if (!isValidReminderHours(hours)) return
        val triggerAt = reminderTriggerAt(now(), hours)
        _reminderDraft.value = null
        viewModelScope.launch { reminderActions.setReminder(draft.noteId, triggerAt) }
    }

    fun onRemoveReminder(noteId: Long) {
        _reminderDraft.value = null
        viewModelScope.launch { reminderActions.clearReminder(noteId) }
    }

    fun currentTimeMillis(): Long = now()

    override fun onCleared() {
        super.onCleared()
        transcription.release()
    }
}

/** Trim and reject blank transcripts. Pure; unit-tested. */
fun sanitizeNoteText(raw: String): String? = raw.trim().ifEmpty { null }
