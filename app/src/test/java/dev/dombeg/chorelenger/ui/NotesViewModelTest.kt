package dev.dombeg.chorelenger.ui

import androidx.lifecycle.ViewModelStore
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.MainDispatcherRule
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import dev.dombeg.chorelenger.reminders.FakeReminderNotifier
import dev.dombeg.chorelenger.reminders.FakeReminderScheduler
import dev.dombeg.chorelenger.reminders.HOUR_MILLIS
import dev.dombeg.chorelenger.reminders.RecurrenceSpec
import dev.dombeg.chorelenger.reminders.ReminderActions
import dev.dombeg.chorelenger.speech.FakeTranscriptionService
import dev.dombeg.chorelenger.speech.VoiceError
import dev.dombeg.chorelenger.speech.VoiceState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Integration test: real Room + real ViewModel; only the speech boundary is faked.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class NotesViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var db: AppDatabase
    private lateinit var dao: NoteDao
    private lateinit var fake: FakeTranscriptionService
    private lateinit var scheduler: FakeReminderScheduler
    private lateinit var notifier: FakeReminderNotifier
    private lateinit var actions: ReminderActions
    private var nowMillis = 1_000_000L
    private val viewModelStore = ViewModelStore()
    private var viewModelCount = 0

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).allowMainThreadQueries().build()
        dao = db.noteDao()
        fake = FakeTranscriptionService()
        scheduler = FakeReminderScheduler()
        notifier = FakeReminderNotifier()
        actions = ReminderActions(dao, scheduler, notifier, now = { nowMillis })
    }

    @After
    fun tearDown() {
        // Cancel every ViewModel scope before the Main dispatcher rule resets.
        viewModelStore.clear()
        db.close()
    }

    private fun viewModel(): NotesViewModel =
        NotesViewModel(dao, fake, actions, now = { nowMillis }).also {
            viewModelStore.put("vm-${viewModelCount++}", it)
        }

    @Test
    fun finalResultInsertsTrimmedNoteAndResetsToIdle() = runTest {
        val vm = viewModel()

        fake.emitResult("  walk the dog  ")
        advanceUntilIdle()

        val notes = vm.notes.first { it.isNotEmpty() }
        assertEquals(1, notes.size)
        assertEquals("walk the dog", notes.first().text)
        assertEquals(VoiceState.Idle, vm.voiceState.value)
    }

    @Test
    fun blankResultInsertsNothing() = runTest {
        val vm = viewModel()

        fake.emitResult("   ")
        advanceUntilIdle()

        assertEquals(emptyList<Any>(), dao.observeAll().first())
        assertEquals(VoiceState.Idle, vm.voiceState.value)
    }

    @Test
    fun identicalTranscriptTwiceProducesTwoNotes() = runTest {
        val vm = viewModel()

        fake.emitResult("walk the dog")
        advanceUntilIdle()
        fake.emitResult("walk the dog")
        advanceUntilIdle()

        val notes = vm.notes.first { it.size == 2 }
        assertEquals(listOf("walk the dog", "walk the dog"), notes.map { it.text })
    }

    @Test
    fun newerNoteAppearsFirst() = runTest {
        val vm = viewModel()

        fake.emitResult("first")
        advanceUntilIdle()
        fake.emitResult("second")
        advanceUntilIdle()

        val notes = vm.notes.first { it.size == 2 }
        assertEquals(listOf("second", "first"), notes.map { it.text })
    }

    @Test
    fun deleteRemovesNote() = runTest {
        val vm = viewModel()
        fake.emitResult("walk the dog")
        advanceUntilIdle()
        val id = vm.notes.first { it.isNotEmpty() }.first().id

        vm.delete(id)
        advanceUntilIdle()

        assertEquals(emptyList<Any>(), dao.observeAll().first())
    }

    @Test
    fun tapStartsWhenIdleAndStopsWhenListening() = runTest {
        val vm = viewModel()

        vm.onRecordButtonTap()
        advanceUntilIdle()
        assertTrue(vm.voiceState.value is VoiceState.Listening)
        assertEquals(1, fake.startCount)

        vm.onRecordButtonTap()
        advanceUntilIdle()
        assertEquals(1, fake.stopCount)
        assertEquals(1, fake.startCount)
    }

    @Test
    fun tapFromErrorRestarts() = runTest {
        val vm = viewModel()

        fake.emitError(VoiceError.Network)
        advanceUntilIdle()
        assertTrue(vm.voiceState.value is VoiceState.Error)

        vm.onRecordButtonTap()
        advanceUntilIdle()
        assertEquals(1, fake.startCount)
    }

    @Test
    fun unavailableRecognizerIsReported() {
        fake.setAvailable(false)
        val vm = viewModel()
        assertFalse(vm.isRecognizerAvailable)
    }

    @Test
    fun clearedReleasesTranscription() {
        val vm = viewModel()
        val onCleared = NotesViewModel::class.java
            .getDeclaredMethod("onCleared")
            .apply { isAccessible = true }
        onCleared.invoke(vm)
        assertEquals(1, fake.releaseCount)
    }

    @Test
    fun editOrdinaryNoteDefaultsToTwentyFourHours() = runTest {
        val id = dao.insert(Note(text = "water plants", createdAt = 1L))
        val vm = viewModel()

        vm.onEditReminder(dao.getById(id)!!)

        val draft = vm.reminderDraft.value!!
        assertEquals(id, draft.noteId)
        assertEquals(24, draft.initialHours)
        assertFalse(draft.hasReminder)
        assertFalse(draft.isPeriodic)
    }

    @Test
    fun editExistingReminderRoundsRemainingHoursUp() = runTest {
        val id = dao.insert(
            Note(
                text = "water plants",
                createdAt = 1L,
                reminderAt = nowMillis + 5L * HOUR_MILLIS + 60_000L,
            ),
        )
        val vm = viewModel()

        vm.onEditReminder(dao.getById(id)!!)

        val draft = vm.reminderDraft.value!!
        assertEquals(6, draft.initialHours)
        assertTrue(draft.hasReminder)
    }

    @Test
    fun editPeriodicNoteExposesItsRecurrence() = runTest {
        val id = dao.insert(
            Note(
                text = "water plants",
                createdAt = 1L,
                reminderAt = nowMillis + HOUR_MILLIS,
                recurrenceUnit = RecurrenceUnit.WEEKS,
                recurrenceCount = 2,
                recurrenceMode = RecurrenceMode.RELATIVE,
            ),
        )
        val vm = viewModel()

        vm.onEditReminder(dao.getById(id)!!)

        val draft = vm.reminderDraft.value!!
        assertTrue(draft.hasReminder)
        assertTrue(draft.isPeriodic)
        assertEquals(
            RecurrenceSpec(RecurrenceUnit.WEEKS, 2, RecurrenceMode.RELATIVE),
            draft.existingRecurrence,
        )
    }

    @Test
    fun confirmOneTimePersistsSchedulesAndClosesDraft() = runTest {
        val id = dao.insert(Note(text = "water plants", createdAt = 1L))
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)

        vm.onConfirmReminder(ReminderSelection.OneTime(2))
        advanceUntilIdle()

        val expected = nowMillis + 2L * HOUR_MILLIS
        assertEquals(expected, dao.getById(id)!!.reminderAt)
        assertNull(dao.getById(id)!!.recurrenceUnit)
        assertEquals(expected, scheduler.scheduled[id])
        assertEquals(null, vm.reminderDraft.value)
    }

    @Test
    fun confirmPeriodicPersistsAndMovesToRepeats() = runTest {
        val id = dao.insert(Note(text = "water plants", createdAt = 1L))
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)
        val firstAt = nowMillis + 2L * HOUR_MILLIS

        vm.onConfirmReminder(
            ReminderSelection.Periodic(firstAt, RecurrenceUnit.MONTHS, 2, RecurrenceMode.ABSOLUTE),
        )
        advanceUntilIdle()

        val note = dao.getById(id)!!
        assertEquals(firstAt, note.reminderAt)
        assertEquals(RecurrenceUnit.MONTHS, note.recurrenceUnit)
        assertEquals(2, note.recurrenceCount)
        assertEquals(RecurrenceMode.ABSOLUTE, note.recurrenceMode)
        assertEquals(firstAt, scheduler.scheduled[id])
        assertEquals(null, vm.reminderDraft.value)
        assertEquals(emptyList<Any>(), dao.observeActive().first())
        assertEquals(listOf(id), dao.observePeriodic().first().map { it.id })
    }

    @Test
    fun confirmPeriodicRejectsPastFirstExecution() = runTest {
        val id = dao.insert(Note(text = "water plants", createdAt = 1L))
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)

        vm.onConfirmReminder(
            ReminderSelection.Periodic(nowMillis, RecurrenceUnit.DAYS, 1, RecurrenceMode.ABSOLUTE),
        )
        advanceUntilIdle()

        assertNull(dao.getById(id)!!.reminderAt)
        assertNull(dao.getById(id)!!.recurrenceUnit)
        assertTrue(vm.reminderDraft.value != null)
    }

    @Test
    fun confirmPeriodicRejectsOutOfRangeCount() = runTest {
        val id = dao.insert(Note(text = "water plants", createdAt = 1L))
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)

        vm.onConfirmReminder(
            ReminderSelection.Periodic(
                nowMillis + HOUR_MILLIS,
                RecurrenceUnit.MONTHS,
                25,
                RecurrenceMode.ABSOLUTE,
            ),
        )
        advanceUntilIdle()

        assertNull(dao.getById(id)!!.reminderAt)
        assertNull(dao.getById(id)!!.recurrenceUnit)
        assertTrue(vm.reminderDraft.value != null)
    }

    @Test
    fun switchingPeriodicToOneTimeClearsRecurrence() = runTest {
        val id = dao.insert(
            Note(
                text = "water plants",
                createdAt = 1L,
                reminderAt = nowMillis + HOUR_MILLIS,
                recurrenceUnit = RecurrenceUnit.DAYS,
                recurrenceCount = 2,
                recurrenceMode = RecurrenceMode.ABSOLUTE,
            ),
        )
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)

        vm.onConfirmReminder(ReminderSelection.OneTime(1))
        advanceUntilIdle()

        val note = dao.getById(id)!!
        assertEquals(nowMillis + HOUR_MILLIS, note.reminderAt)
        assertNull(note.recurrenceUnit)
        assertNull(note.recurrenceCount)
        assertNull(note.recurrenceMode)
        assertEquals(emptyList<Any>(), dao.observePeriodic().first())
    }

    @Test
    fun dismissEditorLeavesNoteUnchanged() = runTest {
        val id = dao.insert(Note(text = "water plants", createdAt = 1L))
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)

        vm.onDismissReminderEditor()
        advanceUntilIdle()

        assertEquals(null, vm.reminderDraft.value)
        assertEquals(null, dao.getById(id)!!.reminderAt)
    }

    @Test
    fun removeReminderKeepsNoteAndCancelsAlarm() = runTest {
        val id = dao.insert(
            Note(
                text = "water plants",
                createdAt = 1L,
                reminderAt = nowMillis + HOUR_MILLIS,
            ),
        )
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)

        vm.onRemoveReminder(id)
        advanceUntilIdle()

        val note = dao.getById(id)!!
        assertEquals(null, note.reminderAt)
        assertEquals(null, note.reminderNotifiedAt)
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
        assertEquals(null, vm.reminderDraft.value)
    }

    @Test
    fun removePeriodicClearsRecurrenceAndReturnsToActiveList() = runTest {
        val id = dao.insert(
            Note(
                text = "water plants",
                createdAt = 1L,
                reminderAt = nowMillis + HOUR_MILLIS,
                recurrenceUnit = RecurrenceUnit.WEEKS,
                recurrenceCount = 1,
                recurrenceMode = RecurrenceMode.ABSOLUTE,
            ),
        )
        val vm = viewModel()
        vm.onEditReminder(dao.getById(id)!!)

        vm.onRemoveReminder(id)
        advanceUntilIdle()

        val note = dao.getById(id)!!
        assertNull(note.reminderAt)
        assertNull(note.recurrenceUnit)
        assertNull(note.recurrenceCount)
        assertNull(note.recurrenceMode)
        assertEquals(listOf(id), dao.observeActive().first().map { it.id })
        assertEquals(emptyList<Any>(), dao.observePeriodic().first())
    }

    @Test
    fun deleteReminderCancelsAlarmAndNotification() = runTest {
        val id = dao.insert(
            Note(
                text = "water plants",
                createdAt = 1L,
                reminderAt = nowMillis + HOUR_MILLIS,
            ),
        )
        val vm = viewModel()

        vm.delete(id)
        advanceUntilIdle()

        assertEquals(null, dao.getById(id))
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }
}
