package dev.dombeg.chorelenger.ui

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.MainDispatcherRule
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.NoteDao
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

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).allowMainThreadQueries().build()
        dao = db.noteDao()
        fake = FakeTranscriptionService()
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun viewModel() = NotesViewModel(dao, fake)

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
}
