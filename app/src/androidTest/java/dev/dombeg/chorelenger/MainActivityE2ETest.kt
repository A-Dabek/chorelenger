package dev.dombeg.chorelenger

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeRight
import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import dev.dombeg.chorelenger.reminders.HOUR_MILLIS
import dev.dombeg.chorelenger.reminders.ReminderActionReceiver
import dev.dombeg.chorelenger.reminders.ReminderAlarmReceiver
import dev.dombeg.chorelenger.reminders.ReminderIntents
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import dev.dombeg.chorelenger.speech.VoiceError
import dev.dombeg.chorelenger.ui.TestTags
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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

    private fun recordNote(text: String) {
        composeRule.onNodeWithTag(TestTags.RecordButton).performClick()
        composeRule.runOnIdle { fake.emitResult(text) }
        waitForText(text)
    }

    private fun noteId(text: String): Long = runBlocking {
        containerRule.container.db.noteDao().observeAll().first()
            .first { it.text == text }.id
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

    private fun chooseOneTime() {
        composeRule.onNodeWithTag(TestTags.ReminderOneTimeOption).performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderHoursField)
                .fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun choosePeriodic() {
        composeRule.onNodeWithTag(TestTags.ReminderPeriodicOption).performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderFirstStep)
                .fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun sendAlarm(noteId: Long) {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.sendBroadcast(
            Intent(context, ReminderAlarmReceiver::class.java)
                .setAction(ReminderIntents.ACTION_REMINDER_ALARM)
                .putExtra(ReminderIntents.EXTRA_NOTE_ID, noteId),
        )
    }

    private fun sendAction(noteId: Long, action: String) {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.sendBroadcast(
            Intent(context, ReminderActionReceiver::class.java)
                .setAction(action)
                .putExtra(ReminderIntents.EXTRA_NOTE_ID, noteId),
        )
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

    @Test
    fun swipeSetReminderShowsBadgeAndSchedulesAlarm() {
        recordNote("walk the dog")
        val id = noteId("walk the dog")
        val before = System.currentTimeMillis()
        openReminderEditor()
        chooseOneTime()

        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderHoursField).performTextInput("2")
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderBadge)
                .fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithTag(TestTags.ReminderBadge).assertIsDisplayed()

        val triggerAt = containerRule.container.fakeScheduler.scheduled[id]
        assertNotNull(triggerAt)
        assertTrue(triggerAt!! >= before + 2L * HOUR_MILLIS)
        assertTrue(triggerAt <= System.currentTimeMillis() + 2L * HOUR_MILLIS + 60_000L)
        assertEquals(triggerAt, runBlocking { containerRule.container.db.noteDao().getById(id)!!.reminderAt })
    }

    @Test
    fun reminderSurvivesActivityRecreation() {
        recordNote("persist reminder")
        val id = noteId("persist reminder")
        openReminderEditor()
        chooseOneTime()
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderBadge)
                .fetchSemanticsNodes().isNotEmpty()
        }
        val triggerAt = containerRule.container.fakeScheduler.scheduled[id]

        composeRule.activityRule.scenario.recreate()

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderBadge)
                .fetchSemanticsNodes().isNotEmpty()
        }
        assertEquals(triggerAt, runBlocking { containerRule.container.db.noteDao().getById(id)!!.reminderAt })
    }

    @Test
    fun alarmBroadcastShowsNotificationAndMarksNotified() {
        recordNote("alarm note")
        val id = noteId("alarm note")
        runBlocking {
            containerRule.container.db.noteDao().setOneTimeReminder(id, System.currentTimeMillis() - 1_000L)
        }

        sendAlarm(id)

        composeRule.waitUntil(5_000) {
            containerRule.container.fakeNotifier.shown.any { it.id == id }
        }
        assertNotNull(
            runBlocking { containerRule.container.db.noteDao().getById(id)!!.reminderNotifiedAt },
        )
    }

    @Test
    fun doneBroadcastDeletesReminderAndCancelsAlarm() {
        recordNote("done note")
        val id = noteId("done note")
        runBlocking {
            containerRule.container.db.noteDao().setOneTimeReminder(id, System.currentTimeMillis() - 1_000L)
        }

        sendAction(id, ReminderIntents.ACTION_REMINDER_DONE)

        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithText("done note").fetchSemanticsNodes().isEmpty()
        }
        composeRule.waitUntil(5_000) {
            containerRule.container.fakeScheduler.cancels.contains(id)
        }
    }

    @Test
    fun snoozeBroadcastReschedulesAndKeepsNote() {
        recordNote("snooze note")
        val id = noteId("snooze note")
        runBlocking {
            containerRule.container.db.noteDao().setOneTimeReminder(id, System.currentTimeMillis() - 1_000L)
        }
        val before = System.currentTimeMillis()

        sendAction(id, ReminderIntents.ACTION_REMINDER_SNOOZE)

        composeRule.waitUntil(5_000) {
            containerRule.container.fakeScheduler.scheduled[id]?.let {
                it >= before + 24L * HOUR_MILLIS
            } ?: false
        }
        val note = runBlocking { containerRule.container.db.noteDao().getById(id) }
        assertNotNull(note)
        assertTrue(note!!.reminderAt!! >= before + 24L * HOUR_MILLIS)
        composeRule.onNodeWithText("snooze note").assertIsDisplayed()
    }

    @Test
    fun createPeriodicMovesToRepeatsAndSurvivesRecreation() {
        recordNote("water plants")
        openReminderEditor()
        choosePeriodic()

        composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderIntervalStep)
                .fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextClearance()
        composeRule.onNodeWithTag(TestTags.ReminderIntervalCountField).performTextInput("2")
        composeRule.onNodeWithTag(TestTags.ReminderUnitWeeks).performClick()
        composeRule.onNodeWithTag(TestTags.ReminderNextButton).performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderModeStep)
                .fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithTag(TestTags.ReminderModeAbsolute).performClick()
        composeRule.onNodeWithTag(TestTags.ReminderConfirmButton).performClick()
        composeRule.waitUntil(5_000) {
            composeRule.onAllNodesWithTag(TestTags.ReminderScreen)
                .fetchSemanticsNodes().isEmpty()
        }

        composeRule.onNodeWithTag(TestTags.RepeatsTab).performClick()
        waitForText("water plants")
        composeRule.onNodeWithTag(TestTags.RecurrenceBadge).assertIsDisplayed()

        composeRule.activityRule.scenario.recreate()

        waitForText("water plants")
        composeRule.onNodeWithText("water plants").assertIsDisplayed()
    }

    @Test
    fun periodicDoneKeepsItemAndAdvancesDue() {
        recordNote("repeat done")
        val id = noteId("repeat done")
        runBlocking {
            containerRule.container.db.noteDao().setPeriodicReminder(
                id,
                System.currentTimeMillis() - 1_000L,
                RecurrenceUnit.DAYS,
                2,
                RecurrenceMode.ABSOLUTE,
            )
        }

        sendAction(id, ReminderIntents.ACTION_REMINDER_DONE)

        composeRule.waitUntil(5_000) {
            val note = runBlocking { containerRule.container.db.noteDao().getById(id) }
            note?.reminderAt != null && note.reminderAt!! > System.currentTimeMillis()
        }
        val note = runBlocking { containerRule.container.db.noteDao().getById(id) }
        assertNotNull(note)
        assertEquals(RecurrenceUnit.DAYS, note!!.recurrenceUnit)
        assertEquals(2, note.recurrenceCount)
    }

    @Test
    fun periodicSnoozeKeepsRecurrenceAndMovesDue() {
        recordNote("repeat snooze")
        val id = noteId("repeat snooze")
        runBlocking {
            containerRule.container.db.noteDao().setPeriodicReminder(
                id,
                System.currentTimeMillis() - 1_000L,
                RecurrenceUnit.WEEKS,
                1,
                RecurrenceMode.RELATIVE,
            )
        }
        val before = System.currentTimeMillis()

        sendAction(id, ReminderIntents.ACTION_REMINDER_SNOOZE)

        composeRule.waitUntil(5_000) {
            containerRule.container.fakeScheduler.scheduled[id]?.let {
                it >= before + 24L * HOUR_MILLIS
            } ?: false
        }
        val note = runBlocking { containerRule.container.db.noteDao().getById(id) }
        assertNotNull(note)
        assertEquals(RecurrenceUnit.WEEKS, note!!.recurrenceUnit)
        assertEquals(RecurrenceMode.RELATIVE, note.recurrenceMode)
    }
}
