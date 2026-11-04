package dev.dombeg.chorelenger.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.speech.FakeTranscriptionService
import dev.dombeg.chorelenger.ui.theme.ChorelengerTheme
import org.junit.After
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

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java,
        ).allowMainThreadQueries().build()
        fake = FakeTranscriptionService()
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun start(fakeService: FakeTranscriptionService) {
        val viewModel = NotesViewModel(db.noteDao(), fakeService)
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
}
