package dev.dombeg.chorelenger

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.dombeg.chorelenger.ui.HomeScreen
import dev.dombeg.chorelenger.ui.NotesViewModel
import dev.dombeg.chorelenger.ui.theme.ChorelengerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as ChorelengerApp).container
        val permissionGranted = container.isAudioPermissionGranted()
        val notificationPermissionGranted = container.isNotificationPermissionGranted()
        setContent {
            ChorelengerTheme {
                val viewModel: NotesViewModel = viewModel {
                    NotesViewModel(
                        noteDao = container.noteDao(),
                        transcription = container.transcriptionService(),
                        reminderActions = container.reminderActions(),
                    )
                }
                HomeScreen(
                    viewModel = viewModel,
                    initialPermissionGranted = permissionGranted,
                    initialNotificationPermissionGranted = notificationPermissionGranted,
                )
            }
        }
    }
}
