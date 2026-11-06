package dev.dombeg.chorelenger.reminders

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.data.Note
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf

@RunWith(AndroidJUnit4::class)
class AndroidReminderNotifierTest {

    @Test
    fun createsHighImportanceChannelAndPostsNotificationWithActions() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val manager = context.getSystemService(NotificationManager::class.java)
        val notifier = AndroidReminderNotifier(context)
        val note = Note(id = 7L, text = "walk the dog", reminderAt = 1_000L)

        notifier.show(note)

        val channel = manager.getNotificationChannel(AndroidReminderNotifier.CHANNEL_ID)
        assertNotNull(channel)
        assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.importance)

        val notification = shadowOf(manager).getNotification(7)
        assertNotNull(notification)
        assertEquals("Reminder", notification.extras.getCharSequence(Notification.EXTRA_TITLE).toString())
        assertEquals(
            "walk the dog",
            notification.extras.getCharSequence(Notification.EXTRA_BIG_TEXT).toString(),
        )
        assertEquals(2, notification.actions.size)
        assertEquals("Done", notification.actions[0].title.toString())
        assertEquals("Snooze 24 h", notification.actions[1].title.toString())

        notifier.cancel(7L)

        assertNull(shadowOf(manager).getNotification(7))
    }
}
