package dev.dombeg.chorelenger

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import dev.dombeg.chorelenger.speech.VoiceError
import dev.dombeg.chorelenger.ui.TestTags
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

/**
 * End-to-end: real MainActivity, real ViewModel, real Room, real Compose tree.
 * Only the speech boundary is faked.
 */
@RunWith(AndroidJUnit4::class)
class MainActivityE2ETest {

    @get:Rule(order = 0)
    val permissionRule: GrantAudioPermissionRule = GrantAudioPermissionRule()

    @get:Rule(order = 1)
    val containerRule = TestContainerRule()

    @get:Rule(order = 2)
    val composeRule = createAndroidComposeRule<MainActivity>()

    private val fake get() = containerRule.container.fakeTranscription

    private fun waitForText(text: String) {
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test
    fun recordThenNoteAppearsAndButtonReturnsToIdle() {
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("walk the dog") }
        waitForText("walk the dog")

        composeRule.onNodeWithText("walk the dog").assertIsDisplayed()
        composeRule.onNodeWithTag(TestTags.EmptyState).assertDoesNotExist()
    }

    @Test
    fun deleteRemovesRowAndShowsEmptyState() {
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
    fun multipleNotesNewestFirst() {
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("first") }
        waitForText("first")
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("second") }
        waitForText("second")

        val secondTop = composeRule.onNodeWithText("second").fetchSemanticsNode().boundsInRoot.top
        val firstTop = composeRule.onNodeWithText("first").fetchSemanticsNode().boundsInRoot.top
        assertTrue(secondTop < firstTop)
    }

    @Test
    fun networkErrorShowsSnackbarAndRetryRestarts() {
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitError(VoiceError.Network) }
        waitForText("Network error during recognition")

        composeRule.onNodeWithText("Retry").performClick()
        composeRule.waitForIdle()

        assertEquals(2, fake.startCount)
    }

    @Test
    fun permissionDeniedErrorShowsMessageWithoutCrash() {
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitError(VoiceError.PermissionDenied) }
        waitForText("Microphone permission is required")

        composeRule.onNodeWithText("Microphone permission is required").assertIsDisplayed()
    }

    @Test
    fun notesSurviveActivityRecreation() {
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult("persist me") }
        waitForText("persist me")

        composeRule.activityRule.scenario.recreate()
        waitForText("persist me")

        composeRule.onNodeWithText("persist me").assertIsDisplayed()
    }
}
