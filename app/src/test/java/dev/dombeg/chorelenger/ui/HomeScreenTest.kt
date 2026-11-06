package dev.dombeg.chorelenger.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeRight
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import dev.dombeg.chorelenger.reminders.FakeReminderNotifier
import dev.dombeg.chorelenger.reminders.FakeReminderScheduler
import dev.dombeg.chorelenger.reminders.HOUR_MILLIS
import dev.dombeg.chorelenger.reminders.ReminderActions
import dev.dombeg.chorelenger.speech.FakeTranscriptionService
import dev.dombeg.chorelenger.ui.theme.ChorelengerTheme
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Integration test: real Compose composables + real ViewModel + real Room.
 * Only the speech boundary is faked.
 */
@RunWith(AndroidJUnit4::class)
class HomeScreenTest {

    @get:Rule
    val composeRule = createComposeRule()

    private lateinit var db: AppDatabase
    private lateinit var fake: FakeTranscriptionService
    private lateinit var scheduler: FakeReminderScheduler
    private lateinit var notifier: FakeReminderNotifier
    private var nowMillis = 1_000_000L

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).allowMainThreadQueries().build()
        fake = FakeTranscriptionService()
        scheduler = FakeReminderScheduler()
        notifier = FakeReminderNotifier()
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun start(fakeService: FakeTranscriptionService) {
        val actions = ReminderActions(
            db.noteDao(),
            scheduler,
            notifier,
            now = { nowMillis },
        )
        val viewModel = NotesViewModel(
            db.noteDao(),
            fakeService,
            actions,
            now = { nowMillis },
        )
        composeRule.setContent {
            ChorelengerTheme {
                HomeScreen(viewModel = viewModel, initialPermissionGranted = true)
            }
        }
    }

    private fun waitForText(text: String) {
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForTag(tag: String) {
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun waitForTagGone(tag: String) {
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(tag).fetchSemanticsNodes().isEmpty()
        }
    }

    private fun insertNote(text: String, reminderAt: Long? = null): Long = runBlocking {
        db.noteDao().insert(
            Note(text = text, createdAt = 1L, reminderAt = reminderAt),
        )
    }

    private fun insertPeriodicNote(
        text: String,
        due: Long,
        unit: RecurrenceUnit = RecurrenceUnit.WEEKS,
        count: Int = 2,
        mode: RecurrenceMode = RecurrenceMode.ABSOLUTE,
    ): Long = runBlocking {
        db.noteDao().insert(
            Note(
                text = text,
                createdAt = 1L,
                reminderAt = due,
                recurrenceUnit = unit,
                recurrenceCount = count,
                recurrenceMode = mode,
            ),
        )
    }

    private fun openReminderEditor() {
        composeRule.onNodeWithTag(TestTags.NoteRow).performTouchInput {
            swipeRight(startX = width * 0.1f, endX = width * 0.9f)
        }
        waitForTag(TestTags.ReminderScreen)
    }

    /** Chooses the One-time card and lands on the hours editor. */
    private fun chooseOneTime() {
        composeRule.onNodeWithTag(TestTags.ReminderOneTimeOption).performClick()
        composeRule.waitForIdle()
        if (composeRule.onAllNodesWithTag(TestTags.ReminderHoursField)
                .fetchSemanticsNodes().isEmpty()
        ) {
            composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        }
        waitForTag(TestTags.ReminderHoursField)
    }

    /** Chooses the Periodic card and lands on the first-execution step. */
    private fun choosePeriodic() {
        composeRule.onNodeWithTag(TestTags.ReminderPeriodicOption).performClick()
        composeRule.waitForIdle()
        if (composeRule.onAllNodesWithTag(TestTags.ReminderFirstStep)
                .fetchSemanticsNodes().isEmpty()
        ) {
            composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        }
        waitForTag(TestTags.ReminderFirstStep)
    }

    private fun firstStepNext() {
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        waitForTag(TestTags.ReminderIntervalStep)
    }

    private fun intervalStepNext() {
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        waitForTag(TestTags.ReminderModeStep)
    }

    @Test
    fun recordThenNoteAppears() {
        start(fake)

        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("walk the dog") }
        waitForText("walk the dog")

        composeRule.onNodeWithText("walk the dog").assertIsDisplayed()
        composeRule.onNodeWithTag(TestTags.EmptyState).assertDoesNotExist()
    }

    @Test
    fun deleteRemovesRowAndShowsEmptyState() {
        start(fake)

        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("temp") }
        waitForText("temp")

        composeRule.onNodeWithTag(TestTags.DeleteButton).performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("temp").fetchSemanticsNodes().isEmpty()
        }

        composeRule.onNodeWithText("temp").assertDoesNotExist()
        composeRule.onNodeWithTag(TestTags.EmptyState).assertIsDisplayed()
    }

    @Test
    fun partialTextIsShownWhileListening() {
        start(fake)

        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitPartial("walk the") }
        waitForText("walk the")

        composeRule.onNodeWithText("walk the").assertIsDisplayed()
    }

    @Test
    fun twoNotesAreShownNewestFirst() {
        start(fake)

        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("first") }
        waitForText("first")
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("second") }
        waitForText("second")

        val secondTop = composeRule.onNodeWithText("second").fetchSemanticsNode().boundsInRoot.top
        val firstTop = composeRule.onNodeWithText("first").fetchSemanticsNode().boundsInRoot.top
        org.junit.Assert.assertTrue(secondTop < firstTop)
    }

    @Test
    fun unavailableRecognizerShowsNotice() {
        val unavailable = FakeTranscriptionService(available = false)
        start(unavailable)

        composeRule.onNodeWithTag(TestTags.UnavailableNotice).assertIsDisplayed()
    }

    @Test
    fun notesTabHasMicrophoneAndRepeatsTabDoesNot() {
        start(fake)

        composeRule.onNodeWithTag(TestTags.RecordButton).assertIsDisplayed()

        composeRule.onNodeWithTag(TestTags.RepeatsTab).performClick()

        composeRule.onNodeWithTag(TestTags.RecordButton).assertDoesNotExist()
        composeRule.onNodeWithTag(TestTags.PeriodicEmptyState).assertIsDisplayed()

        composeRule.onNodeWithTag(TestTags.NotesTab).performClick()

        composeRule.onNodeWithTag(TestTags.RecordButton).assertIsDisplayed()
    }

    @Test
    fun swipeRightOpensTypeStepThenDefaultHours() {
        insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")

        openReminderEditor()

        composeRule.onNodeWithTag(TestTags.ReminderTypeStep).assertIsDisplayed()
        chooseOneTime()

        composeRule.onNodeWithTag(TestTags.ReminderScreen).assertIsDisplayed()
        composeRule.onNodeWithTag(TestTags.ReminderHoursField).assertTextContains("24")
    }

    @Test
    fun confirmTwoHoursPersistsSchedulesAndShowsBadge() {
        val id = insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()
        chooseOneTime()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextInput("2")
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()

        waitForTag(TestTags.ReminderBadge)
        composeRule.onNodeWithTag(TestTags.ReminderScreen).assertDoesNotExist()

        val expected = nowMillis + 2L * HOUR_MILLIS
        assertEquals(expected, runBlocking { db.noteDao().getById(id)!!.reminderAt })
        assertEquals(expected, scheduler.scheduled[id])
        composeRule.onNodeWithTag(TestTags.ReminderBadge).assertIsDisplayed()
    }

    @Test
    fun cancelLeavesNoteUnchanged() {
        val id = insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()

        composeRule.onNodeWithTag(TestTags.ReminderCancelButton).performClick()

        waitForTagGone(TestTags.ReminderScreen)
        assertNull(runBlocking { db.noteDao().getById(id)!!.reminderAt })
    }

    @Test
    fun existingReminderPrefillsRemainingHoursAndCanBeRemoved() {
        val id = insertNote("walk the dog", reminderAt = nowMillis + 5L * HOUR_MILLIS + 60_000L)
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()
        chooseOneTime()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).assertTextContains("6")
        composeRule.onNodeWithTag(TestTags.ReminderRemoveButton).assertIsDisplayed()
        composeRule.onNodeWithTag(TestTags.ReminderRemoveButton).performClick()

        waitForTagGone(TestTags.ReminderScreen)
        composeRule.waitForIdle()
        assertNull(runBlocking { db.noteDao().getById(id)!!.reminderAt })
        assertEquals("walk the dog", runBlocking { db.noteDao().getById(id)!!.text })
        assertTrue(scheduler.cancels.contains(id))
        assertTrue(notifier.cancels.contains(id))
    }

    @Test
    fun deleteReminderCancelsAlarmAndNotification() {
        val id = insertNote("walk the dog", reminderAt = nowMillis + HOUR_MILLIS)
        start(fake)
        waitForText("walk the dog")

        composeRule.onNodeWithTag(TestTags.DeleteButton).performClick()

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("walk the dog").fetchSemanticsNodes().isEmpty()
        }
        composeRule.waitUntil(5_000) {
            scheduler.cancels.contains(id) && notifier.cancels.contains(id)
        }
        composeRule.onNodeWithTag(TestTags.EmptyState).assertIsDisplayed()
    }

    @Test
    fun invalidHoursDisableConfirmAndShowError() {
        insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()
        chooseOneTime()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).assertIsNotEnabled()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextInput("0")
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).assertIsNotEnabled()
        composeRule.onNodeWithText("Enter whole hours between 1 and 8760").assertIsDisplayed()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextInput("abc")
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).assertIsNotEnabled()
    }

    @Test
    fun createPeriodicMovesNoteToRepeatsAndSchedulesFirstDue() {
        val id = insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()
        choosePeriodic()
        firstStepNext()

        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextInput("2")
        composeRule.onNodeWithTag(TestTags.ReminderUnitDays).performClick()
        intervalStepNext()

        composeRule.onNodeWithTag(TestTags.ReminderModeAbsolute).performClick()
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()

        waitForTagGone(TestTags.ReminderScreen)
        composeRule.waitUntil(5_000) {
            runBlocking { db.noteDao().getById(id)?.recurrenceUnit } == RecurrenceUnit.DAYS
        }
        composeRule.onNodeWithTag(TestTags.EmptyState).assertIsDisplayed()

        composeRule.onNodeWithTag(TestTags.RepeatsTab).performClick()
        waitForText("walk the dog")

        composeRule.onNodeWithTag(TestTags.RecurrenceBadge).assertTextContains("Every 2 days")
        val note = runBlocking { db.noteDao().getById(id)!! }
        assertEquals(2, note.recurrenceCount)
        assertEquals(RecurrenceMode.ABSOLUTE, note.recurrenceMode)
        assertNotNull(scheduler.scheduled[id])
    }

    @Test
    fun switchPeriodicToOneTimeReturnsNoteToNotes() {
        val id = insertPeriodicNote("water plants", nowMillis + 5L * HOUR_MILLIS)
        start(fake)
        composeRule.onNodeWithTag(TestTags.RepeatsTab).performClick()
        waitForText("water plants")

        openReminderEditor()
        composeRule.onNodeWithTag(TestTags.ReminderTypeStep).assertIsDisplayed()
        composeRule.onNodeWithTag(TestTags.ReminderOneTimeOption).performClick()
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        waitForTag(TestTags.ReminderHoursField)
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()

        waitForTagGone(TestTags.ReminderScreen)
        composeRule.waitUntil(5_000) {
            runBlocking { db.noteDao().getById(id)?.recurrenceUnit } == null
        }

        composeRule.onNodeWithTag(TestTags.NotesTab).performClick()
        waitForText("water plants")
        assertNull(runBlocking { db.noteDao().getById(id)!!.recurrenceUnit })
    }

    @Test
    fun switchOneTimeToPeriodicMovesNoteToRepeats() {
        val id = insertNote("walk the dog", reminderAt = nowMillis + 5L * HOUR_MILLIS)
        start(fake)
        waitForText("walk the dog")

        openReminderEditor()
        choosePeriodic()
        firstStepNext()
        intervalStepNext()
        composeRule.onNodeWithTag(TestTags.ReminderModeRelative).performClick()
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()

        waitForTagGone(TestTags.ReminderScreen)
        composeRule.waitUntil(5_000) {
            runBlocking { db.noteDao().getById(id)?.recurrenceMode } == RecurrenceMode.RELATIVE
        }

        composeRule.onNodeWithTag(TestTags.RepeatsTab).performClick()
        waitForText("walk the dog")
        composeRule.onNodeWithTag(TestTags.RecurrenceBadge).assertTextContains("1 day after done")
    }

    @Test
    fun removeRepeatReturnsPeriodicNoteToOrdinaryNotes() {
        val id = insertPeriodicNote("water plants", nowMillis + 5L * HOUR_MILLIS)
        start(fake)
        composeRule.onNodeWithTag(TestTags.RepeatsTab).performClick()
        waitForText("water plants")

        openReminderEditor()
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        waitForTag(TestTags.ReminderFirstStep)
        firstStepNext()
        intervalStepNext()
        waitForTag(TestTags.ReminderRemoveButton)
        composeRule.onNodeWithTag(TestTags.ReminderRemoveButton).performScrollTo().performClick()

        waitForTagGone(TestTags.ReminderScreen)
        composeRule.waitUntil(5_000) {
            runBlocking { db.noteDao().getById(id)?.reminderAt } == null
        }

        composeRule.onNodeWithTag(TestTags.NotesTab).performClick()
        waitForText("water plants")
        assertNull(runBlocking { db.noteDao().getById(id)!!.recurrenceUnit })
    }

    @Test
    fun invalidIntervalCountDisablesNext() {
        insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()
        choosePeriodic()
        firstStepNext()

        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).assertIsNotEnabled()

        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextInput("0")
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).assertIsNotEnabled()

        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextInput("366")
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).assertIsNotEnabled()
    }
}
