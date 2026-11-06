package dev.dombeg.chorelenger.reminders

import android.app.AlarmManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Shadows.shadowOf

@RunWith(AndroidJUnit4::class)
class AlarmReminderSchedulerTest {

    @Test
    fun schedulesAndCancelsAnInexactWakeupAlarm() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val scheduler = AlarmReminderScheduler(context)
        val shadow = shadowOf(context.getSystemService(AlarmManager::class.java))

        scheduler.schedule(noteId = 7L, triggerAt = 5_000L)

        val alarms = shadow.scheduledAlarms
        assertEquals(1, alarms.size)
        assertEquals(AlarmManager.RTC_WAKEUP, alarms.first().type)
        assertEquals(5_000L, alarms.first().triggerAtTime)

        scheduler.cancel(7L)

        assertTrue(shadow.scheduledAlarms.isEmpty())
    }
}
