package dev.dombeg.chorelenger

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.ParcelFileDescriptor
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.rules.ExternalResource

/**
 * Grants RECORD_AUDIO before the Activity launches.
 *
 * The recommended `UiAutomation.grantRuntimePermission` is asynchronous, so the
 * Activity can compose before the grant lands and the system permission dialog
 * then interrupts a test. Use that API and poll until the permission is
 * visible; fall back to a synchronous `pm grant` shell command only if needed.
 */
class GrantAudioPermissionRule : ExternalResource() {

    override fun before() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val packageName = context.packageName
        val permission = Manifest.permission.RECORD_AUDIO

        if (isGranted(context, permission)) return

        runCatching {
            instrumentation.uiAutomation.grantRuntimePermission(packageName, permission)
        }
        if (awaitGranted(context, permission, 5_000)) return

        val output = runCatching {
            val descriptor = instrumentation.uiAutomation
                .executeShellCommand("pm grant $packageName $permission")
            ParcelFileDescriptor.AutoCloseInputStream(descriptor)
                .use { it.readBytes().decodeToString() }
        }.getOrElse { "shell fallback failed: $it" }

        if (awaitGranted(context, permission, 2_000)) return

        throw IllegalStateException(
            "RECORD_AUDIO was not granted to $packageName. pm grant output: $output",
        )
    }

    private fun isGranted(context: Context, permission: String): Boolean =
        context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun awaitGranted(context: Context, permission: String, timeoutMs: Long): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (isGranted(context, permission)) return true
            Thread.sleep(50)
        }
        return isGranted(context, permission)
    }
}
