package dev.dombeg.chorelenger

import android.app.Application
import dev.dombeg.chorelenger.reminders.AndroidReminderNotifier

class ChorelengerApp : Application() {

    private val defaultContainer: AppContainer by lazy { DefaultAppContainer(this) }
    private var overrideContainer: AppContainer? = null

    override fun onCreate() {
        super.onCreate()
        AndroidReminderNotifier.ensureChannel(this)
    }

    /**
     * The active container. Tests set this before the Activity launches to swap
     * in fakes; production falls back to [DefaultAppContainer].
     */
    var container: AppContainer
        get() = overrideContainer ?: defaultContainer
        set(value) {
            overrideContainer = value
        }
}
