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
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeRight
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.reminders.FakeReminderNotifier
import dev.dombeg.chorelenger.reminders.FakeReminderScheduler
import dev.dombeg.chorelenger.reminders.HOUR_MILLIS
import dev.dombeg.chorelenger.reminders.ReminderActions
import dev.dombeg.chorelenger.speech.FakeTranscriptionService
import dev.dombeg.chorelenger.ui.theme.ChorelengerTheme
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
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

    private fun insertNote(text: String, reminderAt: Long? = null): Long = runBlocking {
        db.noteDao().insert(
            Note(text = text, createdAt = 1L, reminderAt = reminderAt),
        )
    }

    private fun openReminderEditor() {
        composeRule.onNodeWithTag(TestTags.NoteRow).performTouchInput {
            swipeRight(startX = width * 0.1f, endX = width * 0.9f)
        }
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderScreen)
                .fetchSemanticsNodes().isNotEmpty()
        }
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
    fun swipeRightOpensEditorWithDefaultHours() {
        insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")

        openReminderEditor()

        composeRule.onNodeWithTag(TestTags.ReminderScreen).assertIsDisplayed()
        composeRule.onNodeWithTag(TestTags.ReminderHoursField).assertTextContains("24")
    }

    @Test
    fun confirmTwoHoursPersistsSchedulesAndShowsBadge() {
        val id = insertNote("walk the dog")
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextInput("2")
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderBadge)
                .fetchSemanticsNodes().isNotEmpty()
        }
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

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderScreen)
                .fetchSemanticsNodes().isEmpty()
        }
        assertNull(runBlocking { db.noteDao().getById(id)!!.reminderAt })
    }

    @Test
    fun existingReminderPrefillsRemainingHoursAndCanBeRemoved() {
        val id = insertNote("walk the dog", reminderAt = nowMillis + 5L * HOUR_MILLIS + 60_000L)
        start(fake)
        waitForText("walk the dog")
        openReminderEditor()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).assertTextContains("6")
        composeRule.onNodeWithTag(TestTags.ReminderRemoveButton).assertIsDisplayed()
        composeRule.onNodeWithTag(TestTags.ReminderRemoveButton).performClick()

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderScreen)
                .fetchSemanticsNodes().isEmpty()
        }
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

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).assertIsNotEnabled()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextInput("0")
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).assertIsNotEnabled()
        composeRule.onNodeWithText("Enter whole hours between 1 and 8760").assertIsDisplayed()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextInput("abc")
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).assertIsNotEnabled()
    }
}
