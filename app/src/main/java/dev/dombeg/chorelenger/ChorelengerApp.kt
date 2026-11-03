package dev.dombeg.chorelenger

import android.app.Application

class ChorelengerApp : Application() {

    private val defaultContainer: AppContainer by lazy { DefaultAppContainer(this) }
    private var overrideContainer: AppContainer? = null

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
