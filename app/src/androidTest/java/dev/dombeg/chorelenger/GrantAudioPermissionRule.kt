package dev.dombeg.chorelenger

import android.Manifest
import android.content.pm.PackageManager
import android.os.ParcelFileDescriptor
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.rules.ExternalResource

/**
 * Grants RECORD_AUDIO before the Activity launches.
 *
 * `UiAutomation.grantRuntimePermission` fires the shell command without waiting
 * for it, which lets the Activity compose before the grant lands and makes the
 * system permission dialog appear mid-test. Running `pm grant` and draining its
 * output is synchronous; we then poll until the permission is visible.
 */
class GrantAudioPermissionRule : ExternalResource() {

    override fun before() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val packageName = context.packageName
        val permission = Manifest.permission.RECORD_AUDIO

        val output = runCatching {
            val descriptor = instrumentation.uiAutomation
                .executeShellCommand("pm grant $packageName $permission")
            ParcelFileDescriptor.AutoCloseInputStream(descriptor)
                .use { it.readBytes().decodeToString() }
        }.getOrElse { error("pm grant failed: $it") }

        val deadline = System.currentTimeMillis() + 5_000
        while (System.currentTimeMillis() < deadline) {
            if (context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
                return
            }
            Thread.sleep(50)
        }
        throw IllegalStateException(
            "RECORD_AUDIO was not granted to $packageName. pm grant output: $output",
        )
    }
}
