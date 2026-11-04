package dev.dombeg.chorelenger

import android.Manifest
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.rules.ExternalResource

/**
 * Grants RECORD_AUDIO before the Activity launches, without depending on
 * `androidx.test:rules` (not in the offline cache).
 */
class GrantAudioPermissionRule : ExternalResource() {

    override fun before() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val packageName = instrumentation.targetContext.packageName
        runCatching {
            instrumentation.uiAutomation.grantRuntimePermission(
                packageName,
                Manifest.permission.RECORD_AUDIO,
            )
        }
    }
}
