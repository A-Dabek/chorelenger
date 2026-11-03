package dev.dombeg.chorelenger

import androidx.test.core.app.ApplicationProvider
import org.junit.rules.ExternalResource

/**
 * Installs a [TestAppContainer] on the app before any Activity launches.
 *
 * Declared with a lower `order` than the compose/activity rule so its `before()`
 * runs first and the Activity under test picks up the fake container.
 */
class TestContainerRule : ExternalResource() {

    lateinit var container: TestAppContainer
        private set

    override fun before() {
        val app = ApplicationProvider.getApplicationContext<ChorelengerApp>()
        container = TestAppContainer(app)
        app.container = container
    }

    override fun after() {
        container.db.close()
    }
}
