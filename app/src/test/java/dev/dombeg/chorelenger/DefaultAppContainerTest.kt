package dev.dombeg.chorelenger

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import dev.dombeg.chorelenger.data.Note
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Integration test: the production container wires a working DAO and a
 * non-crashing transcription service.
 */
@RunWith(AndroidJUnit4::class)
class DefaultAppContainerTest {

    private fun container() = DefaultAppContainer(ApplicationProvider.getApplicationContext())

    @Test
    fun noteDaoIsUsable() = runTest {
        val id = container().noteDao().insert(Note(text = "wired"))
        assertTrue(id > 0)
    }

    @Test
    fun transcriptionServiceIsCreatedAndAvailabilityDoesNotCrash() {
        val service = container().transcriptionService()
        assertNotNull(service)
        service.isAvailable()
    }
}
