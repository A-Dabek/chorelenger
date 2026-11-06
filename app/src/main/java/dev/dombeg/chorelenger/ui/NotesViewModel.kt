package dev.dombeg.chorelenger.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import dev.dombeg.chorelenger.reminders.DEFAULT_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.RecurrenceSpec
import dev.dombeg.chorelenger.reminders.ReminderActions
import dev.dombeg.chorelenger.reminders.isValidFirstExecution
import dev.dombeg.chorelenger.reminders.isValidRecurrenceCount
import dev.dombeg.chorelenger.reminders.isValidReminderHours
import dev.dombeg.chorelenger.reminders.recurrenceSpec
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
    val existingReminderAt: Long?,
    val existingRecurrence: RecurrenceSpec?,
    val initialHours: Int,
) {
    val hasReminder: Boolean get() = existingReminderAt != null
    val isPeriodic: Boolean get() = existingRecurrence != null
}

/** What the wizard confirms: either a one-time delay or a periodic rule. */
sealed interface ReminderSelection {
    data class OneTime(val hours: Int) : ReminderSelection

    data class Periodic(
        val firstAt: Long,
        val unit: RecurrenceUnit,
        val count: Int,
        val mode: RecurrenceMode,
    ) : ReminderSelection
}

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

    val notes: StateFlow<List<Note>> = noteDao.observeActive()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val periodicNotes: StateFlow<List<Note>> = noteDao.observePeriodic()
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
            existingReminderAt = note.reminderAt,
            existingRecurrence = note.recurrenceSpec,
            initialHours = initialHours,
        )
    }

    fun onDismissReminderEditor() {
        _reminderDraft.value = null
    }

    fun onConfirmReminder(selection: ReminderSelection) {
        val draft = _reminderDraft.value ?: return
        when (selection) {
            is ReminderSelection.OneTime -> {
                if (!isValidReminderHours(selection.hours)) return
                val triggerAt = reminderTriggerAt(now(), selection.hours)
                _reminderDraft.value = null
                viewModelScope.launch {
                    reminderActions.setOneTimeReminder(draft.noteId, triggerAt)
                }
            }
            is ReminderSelection.Periodic -> {
                if (!isValidRecurrenceCount(selection.unit, selection.count)) return
                if (!isValidFirstExecution(selection.firstAt, now())) return
                _reminderDraft.value = null
                viewModelScope.launch {
                    reminderActions.setPeriodicReminder(
                        draft.noteId,
                        selection.firstAt,
                        selection.unit,
                        selection.count,
                        selection.mode,
                    )
                }
            }
        }
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
